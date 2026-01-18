package config

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"os"
	"strconv"

	"github.com/ThraaxSession/Hash/internal/models"
)

// Load loads configuration from environment variables or defaults
func Load() *models.Config {
	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0" // Listen on all interfaces by default
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	haURL := os.Getenv("HOME_ASSISTANT_URL")
	token := os.Getenv("HA_TOKEN")
	
	refreshInterval := 30 // default 30 seconds
	if interval := os.Getenv("REFRESH_INTERVAL"); interval != "" {
		if parsed, err := strconv.Atoi(interval); err == nil && parsed > 0 {
			refreshInterval = parsed
		}
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "hassh.db"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		// Generate a random secret if not provided
		jwtSecret = generateRandomSecret()
	}

	return &models.Config{
		HomeAssistantURL: haURL,
		Token:            token,
		Host:             host,
		Port:             port,
		RefreshInterval:  refreshInterval,
		DBPath:           dbPath,
		JWTSecret:        jwtSecret,
	}
}

// generateRandomSecret generates a random secret key
func generateRandomSecret() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// LoadFromFile loads configuration from a JSON file
func LoadFromFile(path string) (*models.Config, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	config := &models.Config{}
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(config); err != nil {
		return nil, err
	}

	return config, nil
}
