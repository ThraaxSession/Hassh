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

	r.GET("/register", func(c *gin.Context) {
		c.HTML(http.StatusOK, "register.html", nil)
	})

	r.GET("/settings", func(c *gin.Context) {
		c.HTML(http.StatusOK, "settings.html", nil)
	})

	r.GET("/share/:id", func(c *gin.Context) {
		c.HTML(http.StatusOK, "share.html", nil)
	})

	// API routes
	api := r.Group("/api")
	{
		// Public endpoints
		api.POST("/login", handler.Login)
		api.POST("/verify-otp", handler.VerifyOTP)                       // OTP verification during login
		api.POST("/register", handler.Register)                          // Public registration (only when no admin exists)
		api.GET("/admin-exists", handler.AdminExists)                    // Check if admin exists
		api.GET("/shares/:id/check", handler.CheckShareLinkPassword)     // Check if share link requires password
		api.GET("/shares/:id", handler.GetShareLink)                     // Public share link access (non-password protected)
		api.POST("/shares/:id", handler.GetShareLink)                    // Public share link access (password protected)
		api.POST("/shares/:id/trigger/:entityId", handler.TriggerEntity) // Public trigger for triggerable shares

		// Protected endpoints (require authentication)
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware())
		{
			// User settings
			protected.GET("/settings", handler.GetUserSettings)
			protected.POST("/settings/ha", handler.ConfigureHA)
			protected.POST("/settings/password", handler.ChangePassword)

			// OTP management
			protected.POST("/otp/setup", handler.SetupOTP)
			protected.POST("/otp/enable", handler.EnableOTP)
			protected.POST("/otp/disable", handler.DisableOTP)

			// User list (for sharing) - accessible to all authenticated users
			protected.GET("/users/list", handler.GetUsersList)

			// Entity management
			protected.GET("/entities", handler.GetEntities)
			protected.POST("/entities", handler.AddEntity)
			protected.DELETE("/entities/:id", handler.DeleteEntity)
			protected.GET("/ha/entities", handler.GetAllHAEntities)

			// Entity sharing with other users
			protected.POST("/share-entity", handler.ShareEntityWithUser)
			protected.GET("/shared-with-me", handler.GetSharedWithMe)
			protected.GET("/my-shares", handler.GetMyShares)
			protected.DELETE("/shared-entity/:id", handler.UnshareEntity)
			protected.GET("/shared-entity/:entityId/state", handler.GetSharedEntityState)
			protected.POST("/shared-entity/:entityId/trigger", handler.TriggerSharedEntity)

			// Share link management
			protected.POST("/shares", handler.CreateShareLink)
			protected.GET("/shares", handler.ListShareLinks)
			protected.PUT("/shares/:id", handler.UpdateShareLink)
			protected.DELETE("/shares/:id", handler.DeleteShareLink)

			// Admin endpoints (require admin access)
			admin := protected.Group("")
			admin.Use(middleware.AdminMiddleware())
			{
				admin.GET("/users", handler.ListAllUsers)
				admin.POST("/users", handler.CreateUserByAdmin)
				admin.DELETE("/users/:id", handler.DeleteUser)
				admin.PUT("/users/:id/admin", handler.ToggleUserAdmin)
			}
		}
	}

	// Create server
	addr := cfg.Host + ":" + cfg.Port
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Starting Hassh server on %s", addr)
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
