package ha

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/ThraaxSession/Hash/internal/models"
)

// Client represents a Home Assistant API client
type Client struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client
}

// NewClient creates a new Home Assistant client
func NewClient(baseURL, token string) *Client {
	return &Client{
		BaseURL: baseURL,
		Token:   token,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// GetEntity fetches a specific entity from Home Assistant
func (c *Client) GetEntity(entityID string) (*models.Entity, error) {
	url := fmt.Sprintf("%s/api/states/%s", c.BaseURL, entityID)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get entity: %s - %s", resp.Status, string(body))
	}
	
	var entity models.Entity
	if err := json.NewDecoder(resp.Body).Decode(&entity); err != nil {
		return nil, err
	}
	
	return &entity, nil
}

// GetEntities fetches multiple entities from Home Assistant using concurrent requests
func (c *Client) GetEntities(entityIDs []string) ([]*models.Entity, error) {
	entities := make([]*models.Entity, 0, len(entityIDs))
	
	// Use a channel to collect results
	type result struct {
		entity *models.Entity
		err    error
	}
	results := make(chan result, len(entityIDs))
	
	// Fetch entities concurrently
	for _, entityID := range entityIDs {
		go func(id string) {
			entity, err := c.GetEntity(id)
			results <- result{entity: entity, err: err}
		}(entityID)
	}
	
	// Collect results
	for i := 0; i < len(entityIDs); i++ {
		res := <-results
		if res.err != nil {
			// Log error but continue with other entities
			continue
		}
		entities = append(entities, res.entity)
	}
	
	return entities, nil
}

// GetAllStates fetches all states from Home Assistant
func (c *Client) GetAllStates() ([]*models.Entity, error) {
	url := fmt.Sprintf("%s/api/states", c.BaseURL)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get states: %s - %s", resp.Status, string(body))
	}
	
	var entities []*models.Entity
	if err := json.NewDecoder(resp.Body).Decode(&entities); err != nil {
		return nil, err
	}
	
	return entities, nil
}

// CallService calls a Home Assistant service
func (c *Client) CallService(domain, service string, data map[string]interface{}) error {
	url := fmt.Sprintf("%s/api/services/%s/%s", c.BaseURL, domain, service)
	
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to call service: %s - %s", resp.Status, string(body))
	}
	
	return nil
}
