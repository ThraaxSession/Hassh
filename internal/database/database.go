package database

import (
	"log"

	"github.com/ThraaxSession/Hash/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// DB is the global database instance
var DB *gorm.DB

// Initialize initializes the database connection
func Initialize(dbPath string) error {
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return err
	}

	// Auto migrate the schema
	err = DB.AutoMigrate(
		&models.User{},
		&models.Entity{},
		&models.ShareLink{},
		&models.SharedEntity{},
	)
	if err != nil {
		return err
	}

	// Check if this is the first user and set as admin
	var userCount int64
	DB.Model(&models.User{}).Count(&userCount)
	if userCount == 1 {
		var firstUser models.User
		DB.First(&firstUser)
		if !firstUser.IsAdmin {
			firstUser.IsAdmin = true
			DB.Save(&firstUser)
			log.Println("First user set as admin:", firstUser.Username)
		}
	}

	log.Println("Database initialized successfully")
	return nil
}

// Close closes the database connection
func Close() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
