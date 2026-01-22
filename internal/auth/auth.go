package auth

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/ThraaxSession/Hash/internal/database"
	"github.com/ThraaxSession/Hash/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/pquerna/otp/totp"
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

// GenerateRefreshToken generates a refresh token for a user
func GenerateRefreshToken(user *models.User) (string, error) {
	// Generate a random token
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(bytes)

	// Set expiration to 7 days from now
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	// Store refresh token in database
	refreshToken := models.RefreshToken{
		Token:     token,
		UserID:    user.ID,
		ExpiresAt: expiresAt,
	}

	if err := database.DB.Create(&refreshToken).Error; err != nil {
		return "", err
	}

	return token, nil
}

// ValidateRefreshToken validates a refresh token and returns the associated user
func ValidateRefreshToken(token string) (*models.User, error) {
	var refreshToken models.RefreshToken
	if err := database.DB.Where("token = ?", token).First(&refreshToken).Error; err != nil {
		return nil, errors.New("invalid refresh token")
	}

	// Check if token has expired
	if time.Now().After(refreshToken.ExpiresAt) {
		// Delete expired token
		database.DB.Delete(&refreshToken)
		return nil, errors.New("refresh token expired")
	}

	// Get user
	user, err := GetUserByID(refreshToken.UserID)
	if err != nil {
		return nil, errors.New("user not found")
	}

	return user, nil
}

// RevokeRefreshToken revokes a refresh token
func RevokeRefreshToken(token string) error {
	return database.DB.Where("token = ?", token).Delete(&models.RefreshToken{}).Error
}

// CleanupExpiredRefreshTokens removes expired refresh tokens from the database
func CleanupExpiredRefreshTokens() error {
	return database.DB.Where("expires_at < ?", time.Now()).Delete(&models.RefreshToken{}).Error
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

// GenerateOTPSecret generates a new OTP secret for a user
func GenerateOTPSecret(username string) (string, string, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Hassh",
		AccountName: username,
	})
	if err != nil {
		return "", "", err
	}
	return key.Secret(), key.URL(), nil
}

// VerifyOTP verifies an OTP code against a secret
func VerifyOTP(secret, code string) bool {
	return totp.Validate(code, secret)
}

// GenerateBackupCodes generates 10 backup codes
func GenerateBackupCodes() ([]string, error) {
	codes := make([]string, 10)
	for i := 0; i < 10; i++ {
		bytes := make([]byte, 4)
		if _, err := rand.Read(bytes); err != nil {
			return nil, err
		}
		codes[i] = fmt.Sprintf("%08X", bytes)
	}
	return codes, nil
}

// HashBackupCodes hashes backup codes and stores them as JSON
func HashBackupCodes(codes []string) (string, error) {
	hashedCodes := make([]string, len(codes))
	for i, code := range codes {
		hash, err := HashPassword(code)
		if err != nil {
			return "", err
		}
		hashedCodes[i] = hash
	}
	jsonData, err := json.Marshal(hashedCodes)
	if err != nil {
		return "", err
	}
	return string(jsonData), nil
}

// VerifyBackupCode verifies a backup code and removes it if valid
func VerifyBackupCode(user *models.User, code string) (bool, error) {
	if user.OTPBackupCodes == "" {
		return false, nil
	}

	var hashedCodes []string
	if err := json.Unmarshal([]byte(user.OTPBackupCodes), &hashedCodes); err != nil {
		return false, err
	}

	// Check each backup code
	for i, hashedCode := range hashedCodes {
		if CheckPasswordHash(code, hashedCode) {
			// Remove the used backup code
			hashedCodes = append(hashedCodes[:i], hashedCodes[i+1:]...)
			jsonData, err := json.Marshal(hashedCodes)
			if err != nil {
				return false, err
			}
			user.OTPBackupCodes = string(jsonData)
			if err := database.DB.Save(user).Error; err != nil {
				return false, err
			}
			return true, nil
		}
	}

	return false, nil
}
