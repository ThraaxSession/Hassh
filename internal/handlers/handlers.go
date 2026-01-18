package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
	"time"

	"github.com/ThraaxSession/Hash/internal/ha"
	"github.com/ThraaxSession/Hash/internal/models"
	"github.com/gin-gonic/gin"
)

// Handler manages all HTTP handlers
type Handler struct {
	HAClient    *ha.Client
	EntityStore *models.EntityStore
	ShareStore  *models.ShareStore
	mu          sync.RWMutex
}

// NewHandler creates a new handler
func NewHandler(haClient *ha.Client) *Handler {
	return &Handler{
		HAClient: haClient,
		EntityStore: &models.EntityStore{
			Entities: make(map[string]*models.Entity),
		},
		ShareStore: &models.ShareStore{
			Links: make(map[string]*models.ShareLink),
		},
	}
}

// GetEntities returns all entities
func (h *Handler) GetEntities(c *gin.Context) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	entities := make([]*models.Entity, 0, len(h.EntityStore.Entities))
	for _, entity := range h.EntityStore.Entities {
		entities = append(entities, entity)
	}

	c.JSON(http.StatusOK, entities)
}

// AddEntity adds a new entity to track
func (h *Handler) AddEntity(c *gin.Context) {
	var req struct {
		EntityID string `json:"entity_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Fetch the entity from Home Assistant
	entity, err := h.HAClient.GetEntity(req.EntityID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch entity from Home Assistant: " + err.Error()})
		return
	}

	h.mu.Lock()
	entity.ID = req.EntityID
	h.EntityStore.Entities[req.EntityID] = entity
	h.mu.Unlock()

	c.JSON(http.StatusCreated, entity)
}

// DeleteEntity removes an entity from tracking
func (h *Handler) DeleteEntity(c *gin.Context) {
	entityID := c.Param("id")

	h.mu.Lock()
	defer h.mu.Unlock()

	if _, exists := h.EntityStore.Entities[entityID]; !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entity not found"})
		return
	}

	delete(h.EntityStore.Entities, entityID)
	c.JSON(http.StatusOK, gin.H{"message": "Entity deleted"})
}

// CreateShareLink creates a new share link
func (h *Handler) CreateShareLink(c *gin.Context) {
	var req struct {
		EntityIDs []string  `json:"entity_ids" binding:"required"`
		Type      string    `json:"type" binding:"required"` // "permanent", "counter", "time"
		MaxAccess int       `json:"max_access,omitempty"`
		ExpiresAt time.Time `json:"expires_at,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate type
	if req.Type != "permanent" && req.Type != "counter" && req.Type != "time" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid type. Must be 'permanent', 'counter', or 'time'"})
		return
	}

	// Generate unique ID
	id := generateID()

	shareLink := &models.ShareLink{
		ID:          id,
		EntityIDs:   req.EntityIDs,
		Type:        req.Type,
		MaxAccess:   req.MaxAccess,
		AccessCount: 0,
		ExpiresAt:   req.ExpiresAt,
		CreatedAt:   time.Now(),
		Active:      true,
	}

	h.mu.Lock()
	h.ShareStore.Links[id] = shareLink
	h.mu.Unlock()

	c.JSON(http.StatusCreated, shareLink)
}

// GetShareLink retrieves entities for a share link
func (h *Handler) GetShareLink(c *gin.Context) {
	id := c.Param("id")

	h.mu.Lock()
	shareLink, exists := h.ShareStore.Links[id]
	if !exists {
		h.mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "Share link not found"})
		return
	}

	// Check if link is still valid
	if !shareLink.Active {
		h.mu.Unlock()
		c.JSON(http.StatusForbidden, gin.H{"error": "Share link is no longer active"})
		return
	}

	// Check counter-based restriction
	if shareLink.Type == "counter" && shareLink.AccessCount >= shareLink.MaxAccess {
		shareLink.Active = false
		h.mu.Unlock()
		c.JSON(http.StatusForbidden, gin.H{"error": "Share link has reached maximum access count"})
		return
	}

	// Check time-based restriction
	if shareLink.Type == "time" && time.Now().After(shareLink.ExpiresAt) {
		shareLink.Active = false
		h.mu.Unlock()
		c.JSON(http.StatusForbidden, gin.H{"error": "Share link has expired"})
		return
	}

	// Increment access count and get entity IDs
	shareLink.AccessCount++
	entityIDs := shareLink.EntityIDs
	h.mu.Unlock()

	// Fetch current state of entities
	entities, err := h.HAClient.GetEntities(entityIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch entities"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"entities": entities,
		"share":    shareLink,
	})
}

// ListShareLinks lists all share links
func (h *Handler) ListShareLinks(c *gin.Context) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	links := make([]*models.ShareLink, 0, len(h.ShareStore.Links))
	for _, link := range h.ShareStore.Links {
		links = append(links, link)
	}

	c.JSON(http.StatusOK, links)
}

// DeleteShareLink deletes a share link
func (h *Handler) DeleteShareLink(c *gin.Context) {
	id := c.Param("id")

	h.mu.Lock()
	defer h.mu.Unlock()

	if _, exists := h.ShareStore.Links[id]; !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Share link not found"})
		return
	}

	delete(h.ShareStore.Links, id)
	c.JSON(http.StatusOK, gin.H{"message": "Share link deleted"})
}

// RefreshEntities refreshes all tracked entities from Home Assistant
func (h *Handler) RefreshEntities() error {
	h.mu.RLock()
	entityIDs := make([]string, 0, len(h.EntityStore.Entities))
	for id := range h.EntityStore.Entities {
		entityIDs = append(entityIDs, id)
	}
	h.mu.RUnlock()

	if len(entityIDs) == 0 {
		return nil
	}

	entities, err := h.HAClient.GetEntities(entityIDs)
	if err != nil {
		return err
	}

	h.mu.Lock()
	for _, entity := range entities {
		entity.ID = entity.EntityID
		h.EntityStore.Entities[entity.EntityID] = entity
	}
	h.mu.Unlock()

	return nil
}

// GetAllHAEntities fetches all available entities from Home Assistant
func (h *Handler) GetAllHAEntities(c *gin.Context) {
	entities, err := h.HAClient.GetAllStates()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch entities from Home Assistant: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, entities)
}

func generateID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
