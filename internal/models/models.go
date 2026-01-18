package models

import "time"

// Entity represents a Home Assistant entity
type Entity struct {
	ID          string                 `json:"id"`
	EntityID    string                 `json:"entity_id"`
	State       string                 `json:"state"`
	Attributes  map[string]interface{} `json:"attributes"`
	LastChanged time.Time              `json:"last_changed"`
	LastUpdated time.Time              `json:"last_updated"`
}

// ShareLink represents a shareable link
type ShareLink struct {
	ID          string    `json:"id"`
	EntityIDs   []string  `json:"entity_ids"`
	Type        string    `json:"type"` // "permanent", "counter", "time"
	MaxAccess   int       `json:"max_access,omitempty"`
	AccessCount int       `json:"access_count"`
	ExpiresAt   time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	Active      bool      `json:"active"`
}

// Config represents application configuration
type Config struct {
	HomeAssistantURL string `json:"home_assistant_url"`
	Token            string `json:"token"`
	Port             string `json:"port"`
	RefreshInterval  int    `json:"refresh_interval"` // in seconds
}

// EntityStore holds entities in memory
type EntityStore struct {
	Entities map[string]*Entity
}

// ShareStore holds share links in memory
type ShareStore struct {
	Links map[string]*ShareLink
}
