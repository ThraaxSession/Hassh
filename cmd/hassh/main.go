package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ThraaxSession/Hash/internal/config"
	"github.com/ThraaxSession/Hash/internal/ha"
	"github.com/ThraaxSession/Hash/internal/handlers"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Validate configuration
	if cfg.HomeAssistantURL == "" || cfg.Token == "" {
		log.Println("Warning: HOME_ASSISTANT_URL and HA_TOKEN environment variables should be set")
		log.Println("You can set them later through the configuration endpoint")
	}

	// Create Home Assistant client
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

	// Routes
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", nil)
	})

	r.GET("/share/:id", func(c *gin.Context) {
		c.HTML(http.StatusOK, "share.html", nil)
	})

	// API routes
	api := r.Group("/api")
	{
		// Entity management
		api.GET("/entities", handler.GetEntities)
		api.POST("/entities", handler.AddEntity)
		api.DELETE("/entities/:id", handler.DeleteEntity)
		api.GET("/ha/entities", handler.GetAllHAEntities)

		// Share link management
		api.POST("/shares", handler.CreateShareLink)
		api.GET("/shares", handler.ListShareLinks)
		api.GET("/shares/:id", handler.GetShareLink)
		api.DELETE("/shares/:id", handler.DeleteShareLink)
	}

	// Create server
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Starting Hassh server on port %s", cfg.Port)
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
