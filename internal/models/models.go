package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// User represents an authenticated user
type User struct {
	ID                    uint      `gorm:"primarykey" json:"id"`
	Username              string    `gorm:"uniqueIndex;not null" json:"username"`
	Password              string    `gorm:"not null" json:"-"` // Hashed password (not exposed in JSON)
	HAToken               string    `json:"-"`                 // Home Assistant Token (not exposed in JSON)
	HAURL                 string    `json:"-"`                 // Home Assistant URL
	IsAdmin               bool      `gorm:"default:false" json:"is_admin"`
	RequirePasswordChange bool      `gorm:"default:false" json:"require_password_change"`
	OTPSecret             string    `json:"-"`                                       // OTP secret (not exposed in JSON)
	OTPEnabled            bool      `gorm:"default:false" json:"otp_enabled"`        // Whether OTP is enabled
	OTPBackupCodes        string    `json:"-"`                                       // JSON array of hashed backup codes
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// SharedEntity represents an entity shared with another user
type SharedEntity struct {
	ID         uint      `gorm:"primarykey" json:"id"`
	EntityID   string    `gorm:"not null" json:"EntityID"`
	OwnerID    uint      `gorm:"not null" json:"OwnerID"`
	Owner      User      `gorm:"foreignKey:OwnerID" json:"Owner"`
	SharedWith uint      `gorm:"not null" json:"SharedWith"`
	SharedUser User      `gorm:"foreignKey:SharedWith" json:"SharedUser"`
	AccessMode string    `gorm:"default:readonly" json:"AccessMode"` // "readonly", "triggerable"
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Entity represents a Home Assistant entity
type Entity struct {
	ID          uint                   `gorm:"primarykey" json:"id"`
	EntityID    string                 `gorm:"not null" json:"entity_id"`
	State       string                 `json:"state"`
	Attributes  JSON                   `json:"attributes"`
	LastChanged time.Time              `json:"last_changed"`
	LastUpdated time.Time              `json:"last_updated"`
	UserID      uint                   `gorm:"not null" json:"user_id"`
	User        User                   `gorm:"foreignKey:UserID" json:"-"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// BeforeCreate hook to ensure unique entity per user
func (e *Entity) BeforeCreate(tx *gorm.DB) error {
	var count int64
	tx.Model(&Entity{}).Where("entity_id = ? AND user_id = ?", e.EntityID, e.UserID).Count(&count)
	if count > 0 {
		return gorm.ErrDuplicatedKey
	}
	return nil
}

// ShareLink represents a shareable link
type ShareLink struct {
	ID          string    `gorm:"primarykey" json:"id"`
	EntityIDs   JSON      `json:"entity_ids"` // JSON array of entity IDs
	Type        string    `json:"type"`       // "permanent", "counter", "time"
	AccessMode  string    `json:"access_mode"` // "readonly", "triggerable"
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
	Host             string `json:"host"`
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
	if len(data) == 0 || string(data) == "null" {
		*j = nil
		return nil
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
