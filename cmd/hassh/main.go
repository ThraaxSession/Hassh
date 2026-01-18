package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ThraaxSession/Hash/internal/auth"
	"github.com/ThraaxSession/Hash/internal/config"
	"github.com/ThraaxSession/Hash/internal/database"
	"github.com/ThraaxSession/Hash/internal/ha"
	"github.com/ThraaxSession/Hash/internal/handlers"
	"github.com/ThraaxSession/Hash/internal/middleware"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	if err := database.Initialize(cfg.DBPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Set JWT secret
	auth.SetJWTSecret(cfg.JWTSecret)

	// Validate configuration
	if cfg.HomeAssistantURL == "" {
		log.Println("Warning: HOME_ASSISTANT_URL environment variable should be set")
		log.Println("Users will need to provide it during login")
	}

	// Create Home Assistant client (for refresh timer, will use user tokens for actual requests)
	haClient := ha.NewClient(cfg.HomeAssistantURL, cfg.Token)

	// Create handler
	handler := handlers.NewHandler(haClient)

	// Start refresh timer
	go startRefreshTimer(handler, cfg.RefreshInterval)

	// Setup Gin router
	r := gin.Default()

	// Serve static files
	r.Static("/static", "./static")
	r.LoadHTMLGlob("templates/*")

	// Public routes
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", nil)
	})

	r.GET("/login", func(c *gin.Context) {
		c.HTML(http.StatusOK, "login.html", nil)
	})

	r.GET("/share/:id", func(c *gin.Context) {
		c.HTML(http.StatusOK, "share.html", nil)
	})

	// API routes
	api := r.Group("/api")
	{
		// Public endpoints
		api.POST("/login", handler.Login)
		api.GET("/shares/:id", handler.GetShareLink)                   // Public share link access
		api.POST("/shares/:id/trigger/:entityId", handler.TriggerEntity) // Public trigger for triggerable shares

		// Protected endpoints (require authentication)
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware())
		{
			// Entity management
			protected.GET("/entities", handler.GetEntities)
			protected.POST("/entities", handler.AddEntity)
			protected.DELETE("/entities/:id", handler.DeleteEntity)
			protected.GET("/ha/entities", handler.GetAllHAEntities)

			// Share link management
			protected.POST("/shares", handler.CreateShareLink)
			protected.GET("/shares", handler.ListShareLinks)
			protected.DELETE("/shares/:id", handler.DeleteShareLink)
		}
	}

	// Create server
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Starting Hassh server on port %s", cfg.Port)
		log.Printf("Database: %s", cfg.DBPath)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
}

func startRefreshTimer(handler *handlers.Handler, intervalSeconds int) {
	ticker := time.NewTicker(time.Duration(intervalSeconds) * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		if err := handler.RefreshEntities(); err != nil {
			log.Printf("Error refreshing entities: %v", err)
		} else {
			log.Println("Entities refreshed successfully")
		}
	}
}
