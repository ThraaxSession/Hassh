package migrations

import (
	"fmt"
	"log"

	"github.com/ThraaxSession/Hash/internal/models"
	"gorm.io/gorm"
)

// Migration represents a database migration
type Migration struct {
	Version     int
	Description string
	Up          func(*gorm.DB) error
	Down        func(*gorm.DB) error
}

// MigrationHistory tracks applied migrations
type MigrationHistory struct {
	ID          uint   `gorm:"primarykey"`
	Version     int    `gorm:"uniqueIndex;not null"`
	Description string `gorm:"not null"`
	AppliedAt   int64  `gorm:"autoCreateTime"`
}

// migrations is the list of all migrations in order
var migrations = []Migration{
	{
		Version:     1,
		Description: "Add OTP fields to users table",
		Up:          migrateV1Up,
		Down:        migrateV1Down,
	},
}

// migrateV1Up adds OTP-related fields to the users table
func migrateV1Up(db *gorm.DB) error {
	// Check and add otp_secret column
	if !db.Migrator().HasColumn(&models.User{}, "otp_secret") {
		if err := db.Exec("ALTER TABLE users ADD COLUMN otp_secret TEXT DEFAULT ''").Error; err != nil {
			return fmt.Errorf("failed to add otp_secret column: %w", err)
		}
		log.Println("Migration V1: Added otp_secret column")
	} else {
		log.Println("Migration V1: otp_secret column already exists, skipping")
	}
	
	// Check and add otp_enabled column
	if !db.Migrator().HasColumn(&models.User{}, "otp_enabled") {
		if err := db.Exec("ALTER TABLE users ADD COLUMN otp_enabled INTEGER DEFAULT 0").Error; err != nil {
			return fmt.Errorf("failed to add otp_enabled column: %w", err)
		}
		log.Println("Migration V1: Added otp_enabled column")
	} else {
		log.Println("Migration V1: otp_enabled column already exists, skipping")
	}
	
	// Check and add otp_backup_codes column
	if !db.Migrator().HasColumn(&models.User{}, "otp_backup_codes") {
		if err := db.Exec("ALTER TABLE users ADD COLUMN otp_backup_codes TEXT DEFAULT ''").Error; err != nil {
			return fmt.Errorf("failed to add otp_backup_codes column: %w", err)
		}
		log.Println("Migration V1: Added otp_backup_codes column")
	} else {
		log.Println("Migration V1: otp_backup_codes column already exists, skipping")
	}

	log.Println("Migration V1: Successfully completed")
	return nil
}

// migrateV1Down removes OTP-related fields from the users table
func migrateV1Down(db *gorm.DB) error {
	// SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
	// For now, we'll just log a warning
	log.Println("Migration V1 Down: SQLite doesn't support DROP COLUMN. Manual intervention required.")
	log.Println("To rollback, you would need to recreate the users table without OTP columns.")
	return nil
}

// Run executes all pending migrations
func Run(db *gorm.DB) error {
	// Create migration history table if it doesn't exist
	if err := db.AutoMigrate(&MigrationHistory{}); err != nil {
		return fmt.Errorf("failed to create migration history table: %w", err)
	}

	// Get current migration version
	var lastMigration MigrationHistory
	result := db.Order("version desc").First(&lastMigration)
	currentVersion := 0
	if result.Error == nil {
		currentVersion = lastMigration.Version
	}

	log.Printf("Current database version: %d", currentVersion)

	// Run pending migrations
	for _, migration := range migrations {
		if migration.Version <= currentVersion {
			continue
		}

		log.Printf("Running migration V%d: %s", migration.Version, migration.Description)

		// Execute the migration
		if err := migration.Up(db); err != nil {
			return fmt.Errorf("migration V%d failed: %w", migration.Version, err)
		}

		// Record the migration
		history := MigrationHistory{
			Version:     migration.Version,
			Description: migration.Description,
		}
		if err := db.Create(&history).Error; err != nil {
			return fmt.Errorf("failed to record migration V%d: %w", migration.Version, err)
		}

		log.Printf("Migration V%d completed successfully", migration.Version)
	}

	if currentVersion == len(migrations) {
		log.Println("Database is up to date")
	}

	return nil
}

// Rollback rolls back the last migration
func Rollback(db *gorm.DB) error {
	var lastMigration MigrationHistory
	if err := db.Order("version desc").First(&lastMigration).Error; err != nil {
		return fmt.Errorf("no migrations to rollback: %w", err)
	}

	// Find the migration
	var targetMigration *Migration
	for i := range migrations {
		if migrations[i].Version == lastMigration.Version {
			targetMigration = &migrations[i]
			break
		}
	}

	if targetMigration == nil {
		return fmt.Errorf("migration V%d not found", lastMigration.Version)
	}

	log.Printf("Rolling back migration V%d: %s", targetMigration.Version, targetMigration.Description)

	// Execute the rollback
	if err := targetMigration.Down(db); err != nil {
		return fmt.Errorf("rollback V%d failed: %w", targetMigration.Version, err)
	}

	// Remove the migration history record
	if err := db.Delete(&lastMigration).Error; err != nil {
		return fmt.Errorf("failed to remove migration V%d from history: %w", targetMigration.Version, err)
	}

	log.Printf("Migration V%d rolled back successfully", targetMigration.Version)
	return nil
}
