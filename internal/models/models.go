package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// User represents an authenticated user
type User struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	Username  string    `gorm:"uniqueIndex;not null" json:"username"`
	HAToken   string    `gorm:"not null" json:"-"` // Home Assistant Token (not exposed in JSON)
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Entity represents a Home Assistant entity
type Entity struct {
	ID          uint                   `gorm:"primarykey" json:"id"`
	EntityID    string                 `gorm:"uniqueIndex;not null" json:"entity_id"`
	State       string                 `json:"state"`
	Attributes  JSON                   `json:"attributes"`
	LastChanged time.Time              `json:"last_changed"`
	LastUpdated time.Time              `json:"last_updated"`
	UserID      uint                   `gorm:"not null" json:"user_id"`
	User        User                   `gorm:"foreignKey:UserID" json:"-"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// ShareLink represents a shareable link
type ShareLink struct {
	ID          string    `gorm:"primarykey" json:"id"`
	EntityIDs   JSON      `json:"entity_ids"` // JSON array of entity IDs
	Type        string    `json:"type"`       // "permanent", "counter", "time"
	MaxAccess   int       `json:"max_access,omitempty"`
	AccessCount int       `json:"access_count"`
	ExpiresAt   time.Time `json:"expires_at,omitempty"`
	Active      bool      `json:"active"`
	UserID      uint      `gorm:"not null" json:"user_id"`
	User        User      `gorm:"foreignKey:UserID" json:"-"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Config represents application configuration
type Config struct {
	HomeAssistantURL string `json:"home_assistant_url"`
	Token            string `json:"token"`
	Port             string `json:"port"`
	RefreshInterval  int    `json:"refresh_interval"` // in seconds
	DBPath           string `json:"db_path"`
	JWTSecret        string `json:"jwt_secret"`
}

// JSON is a custom type for storing JSON data in SQLite
type JSON []byte

// Scan implements the sql.Scanner interface
func (j *JSON) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return gorm.ErrInvalidData
	}
	*j = bytes
	return nil
}

// Value implements the driver.Valuer interface
func (j JSON) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return []byte(j), nil
}

// MarshalJSON implements json.Marshaler
func (j JSON) MarshalJSON() ([]byte, error) {
	if j == nil || len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

// UnmarshalJSON implements json.Unmarshaler
func (j *JSON) UnmarshalJSON(data []byte) error {
	if j == nil {
		return gorm.ErrInvalidData
	}
	*j = data
	return nil
}

// ToMap converts JSON to map
func (j JSON) ToMap() (map[string]interface{}, error) {
	var result map[string]interface{}
	if err := json.Unmarshal(j, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// ToStringSlice converts JSON to string slice
func (j JSON) ToStringSlice() ([]string, error) {
	var result []string
	if err := json.Unmarshal(j, &result); err != nil {
		return nil, err
	}
	return result, nil
}
