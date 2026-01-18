package config

import (
	"encoding/json"
	"os"
	"strconv"

	"github.com/ThraaxSession/Hash/internal/models"
)

// Load loads configuration from environment variables or defaults
func Load() *models.Config {
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

	return &models.Config{
		HomeAssistantURL: haURL,
		Token:            token,
		Port:             port,
		RefreshInterval:  refreshInterval,
	}
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
