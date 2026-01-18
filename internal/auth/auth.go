package auth

import (
	"errors"
	"time"

	"github.com/ThraaxSession/Hash/internal/database"
	"github.com/ThraaxSession/Hash/internal/ha"
	"github.com/ThraaxSession/Hash/internal/models"
	"github.com/golang-jwt/jwt/v5"
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

// ValidateHAToken validates a Home Assistant token and creates/updates user
func ValidateHAToken(haURL, token, username string) (*models.User, error) {
	// Create HA client and validate token by fetching states
	client := ha.NewClient(haURL, token)
	_, err := client.GetAllStates()
	if err != nil {
		return nil, errors.New("invalid Home Assistant token")
	}

	// Check if user exists
	var user models.User
	result := database.DB.Where("username = ?", username).First(&user)
	
	if result.Error != nil {
		// Create new user
		user = models.User{
			Username: username,
			HAToken:  token,
			HAURL:    haURL,
		}
		if err := database.DB.Create(&user).Error; err != nil {
			return nil, err
		}
	} else {
		// Update token and URL
		user.HAToken = token
		user.HAURL = haURL
		if err := database.DB.Save(&user).Error; err != nil {
			return nil, err
		}
	}

	return &user, nil
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
