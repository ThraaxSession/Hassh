package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/ThraaxSession/Hash/internal/auth"
	"github.com/ThraaxSession/Hash/internal/database"
	"github.com/ThraaxSession/Hash/internal/ha"
	"github.com/ThraaxSession/Hash/internal/models"
	"github.com/gin-gonic/gin"
)

// Handler manages all HTTP handlers
type Handler struct {
	HAClient *ha.Client
	HAURL    string
}

// NewHandler creates a new handler
func NewHandler(haClient *ha.Client, haURL string) *Handler {
	return &Handler{
		HAClient: haClient,
		HAURL:    haURL,
	}
}

// Login handles user login with HA token
func (h *Handler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		HAToken  string `json:"ha_token" binding:"required"`
		HAURL    string `json:"ha_url" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate HA token
	user, err := auth.ValidateHAToken(req.HAURL, req.HAToken, req.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Home Assistant credentials: " + err.Error()})
		return
	}

	// Generate JWT token
	token, err := auth.GenerateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  user,
	})
}

// GetEntities returns all entities for the authenticated user
func (h *Handler) GetEntities(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var entities []models.Entity
	if err := database.DB.Where("user_id = ?", userID).Find(&entities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch entities"})
		return
	}

	c.JSON(http.StatusOK, entities)
}

// AddEntity adds a new entity to track
func (h *Handler) AddEntity(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	user := c.MustGet("user").(*models.User)

	var req struct {
		EntityID string `json:"entity_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create HA client with user's token
	haClient := ha.NewClient(h.HAURL, user.HAToken)

	// Fetch the entity from Home Assistant
	haEntity, err := haClient.GetEntity(req.EntityID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch entity from Home Assistant: " + err.Error()})
		return
	}

	// Convert attributes to JSON
	attributesJSON, err := json.Marshal(haEntity.Attributes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process entity attributes"})
		return
	}

	entity := models.Entity{
		EntityID:    req.EntityID,
		State:       haEntity.State,
		Attributes:  attributesJSON,
		LastChanged: haEntity.LastChanged,
		LastUpdated: haEntity.LastUpdated,
		UserID:      userID,
	}

	if err := database.DB.Create(&entity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save entity"})
		return
	}

	c.JSON(http.StatusCreated, entity)
}

// DeleteEntity removes an entity from tracking
func (h *Handler) DeleteEntity(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	entityID := c.Param("id")

	result := database.DB.Where("entity_id = ? AND user_id = ?", entityID, userID).Delete(&models.Entity{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete entity"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entity not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Entity deleted"})
}

// CreateShareLink creates a new share link
func (h *Handler) CreateShareLink(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

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

	// Convert entity IDs to JSON
	entityIDsJSON, err := json.Marshal(req.EntityIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process entity IDs"})
		return
	}

	shareLink := models.ShareLink{
		ID:          id,
		EntityIDs:   entityIDsJSON,
		Type:        req.Type,
		MaxAccess:   req.MaxAccess,
		AccessCount: 0,
		ExpiresAt:   req.ExpiresAt,
		Active:      true,
		UserID:      userID,
	}

	if err := database.DB.Create(&shareLink).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create share link"})
		return
	}

	c.JSON(http.StatusCreated, shareLink)
}

// GetShareLink retrieves entities for a share link (public endpoint)
func (h *Handler) GetShareLink(c *gin.Context) {
	id := c.Param("id")

	var shareLink models.ShareLink
	if err := database.DB.Preload("User").First(&shareLink, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Share link not found"})
		return
	}

	// Check if link is still valid
	if !shareLink.Active {
		c.JSON(http.StatusForbidden, gin.H{"error": "Share link is no longer active"})
		return
	}

	// Check counter-based restriction
	if shareLink.Type == "counter" && shareLink.AccessCount >= shareLink.MaxAccess {
		shareLink.Active = false
		database.DB.Save(&shareLink)
		c.JSON(http.StatusForbidden, gin.H{"error": "Share link has reached maximum access count"})
		return
	}

	// Check time-based restriction
	if shareLink.Type == "time" && time.Now().After(shareLink.ExpiresAt) {
		shareLink.Active = false
		database.DB.Save(&shareLink)
		c.JSON(http.StatusForbidden, gin.H{"error": "Share link has expired"})
		return
	}

	// Increment access count
	shareLink.AccessCount++
	database.DB.Save(&shareLink)

	// Get entity IDs from JSON
	var entityIDs []string
	if err := json.Unmarshal(shareLink.EntityIDs, &entityIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process entity IDs"})
		return
	}

	// Create HA client with user's token
	haClient := ha.NewClient(h.HAURL, shareLink.User.HAToken)

	// Fetch current state of entities
	entities, err := haClient.GetEntities(entityIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch entities"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"entities": entities,
		"share":    shareLink,
	})
}

// ListShareLinks lists all share links for the authenticated user
func (h *Handler) ListShareLinks(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var links []models.ShareLink
	if err := database.DB.Where("user_id = ?", userID).Find(&links).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch share links"})
		return
	}

	c.JSON(http.StatusOK, links)
}

// DeleteShareLink deletes a share link
func (h *Handler) DeleteShareLink(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id := c.Param("id")

	result := database.DB.Where("id = ? AND user_id = ?", id, userID).Delete(&models.ShareLink{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete share link"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Share link not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Share link deleted"})
}

// RefreshEntities refreshes all tracked entities from Home Assistant for all users
func (h *Handler) RefreshEntities() error {
	var users []models.User
	if err := database.DB.Find(&users).Error; err != nil {
		return err
	}

	for _, user := range users {
		var entities []models.Entity
		if err := database.DB.Where("user_id = ?", user.ID).Find(&entities).Error; err != nil {
			continue
		}

		if len(entities) == 0 {
			continue
		}

		// Create HA client with user's token
		haClient := ha.NewClient(h.HAURL, user.HAToken)

		// Get entity IDs
		entityIDs := make([]string, len(entities))
		for i, entity := range entities {
			entityIDs[i] = entity.EntityID
		}

		// Fetch updated entities
		updatedEntities, err := haClient.GetEntities(entityIDs)
		if err != nil {
			continue
		}

		// Update entities in database
		for _, updatedEntity := range updatedEntities {
			attributesJSON, err := json.Marshal(updatedEntity.Attributes)
			if err != nil {
				continue
			}

			database.DB.Model(&models.Entity{}).
				Where("entity_id = ? AND user_id = ?", updatedEntity.EntityID, user.ID).
				Updates(map[string]interface{}{
					"state":        updatedEntity.State,
					"attributes":   attributesJSON,
					"last_changed": updatedEntity.LastChanged,
					"last_updated": updatedEntity.LastUpdated,
				})
		}
	}

	return nil
}

// GetAllHAEntities fetches all available entities from Home Assistant for the authenticated user
func (h *Handler) GetAllHAEntities(c *gin.Context) {
	user := c.MustGet("user").(*models.User)

	// Create HA client with user's token
	haClient := ha.NewClient(h.HAURL, user.HAToken)

	entities, err := haClient.GetAllStates()
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
