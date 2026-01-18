package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/ThraaxSession/Hash/internal/database"
	"github.com/ThraaxSession/Hash/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret []byte

// SetJWTSecret sets the JWT secret key
func SetJWTSecret(secret string) {
	jwtSecret = []byte(secret)
}

// Claims represents JWT claims
type Claims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// GenerateRandomPassword generates a random password
func GenerateRandomPassword() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// HashPassword hashes a password using bcrypt
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// CheckPasswordHash compares a password with a hash
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// ValidateCredentials validates username and password
func ValidateCredentials(username, password string) (*models.User, error) {
	var user models.User
	result := database.DB.Where("username = ?", username).First(&user)
	
	if result.Error != nil {
		return nil, errors.New("invalid username or password")
	}

	if !CheckPasswordHash(password, user.Password) {
		return nil, errors.New("invalid username or password")
	}

	return &user, nil
}

// CreateUser creates a new user with a generated password
func CreateUser(username string) (*models.User, string, error) {
	// Check if user already exists
	var existingUser models.User
	result := database.DB.Where("username = ?", username).First(&existingUser)
	if result.Error == nil {
		return nil, "", errors.New("username already exists")
	}

	// Check if this is the first user
	var userCount int64
	database.DB.Model(&models.User{}).Count(&userCount)
	isFirstUser := userCount == 0

	// Generate random password
	password := GenerateRandomPassword()
	hashedPassword, err := HashPassword(password)
	if err != nil {
		return nil, "", err
	}

	user := models.User{
		Username:              username,
		Password:              hashedPassword,
		IsAdmin:               isFirstUser, // First user is admin
		RequirePasswordChange: true,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		return nil, "", err
	}

	return &user, password, nil
}

// CreateUserByAdmin creates a new user by admin (admin only)
func CreateUserByAdmin(username string) (*models.User, string, error) {
	// Check if user already exists
	var existingUser models.User
	result := database.DB.Where("username = ?", username).First(&existingUser)
	if result.Error == nil {
		return nil, "", errors.New("username already exists")
	}

	// Generate random password
	password := GenerateRandomPassword()
	hashedPassword, err := HashPassword(password)
	if err != nil {
		return nil, "", err
	}

	user := models.User{
		Username:              username,
		Password:              hashedPassword,
		IsAdmin:               false,
		RequirePasswordChange: true,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		return nil, "", err
	}

	return &user, password, nil
}

// GenerateToken generates a JWT token for a user
func GenerateToken(user *models.User) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID:   user.ID,
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ValidateToken validates a JWT token and returns the claims
func ValidateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

// GetUserByID retrieves a user by ID
func GetUserByID(userID uint) (*models.User, error) {
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		return nil, err
	}
	return &user, nil
}
