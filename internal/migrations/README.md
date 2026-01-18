# Database Migrations

This directory contains the database migration system for Hassh.

## Overview

The migration system provides versioned, trackable schema changes to prevent breaking changes when upgrading the application.

## How It Works

1. **Initial Table Creation**: GORM's AutoMigrate creates base tables if they don't exist
2. **Migrations**: The migration system runs versioned migrations to modify existing tables
3. **Migration History**: A `migration_histories` table tracks which migrations have been applied

## Migration Execution Order

When the application starts:

1. `DB.AutoMigrate()` runs first - creates tables and adds new columns (safe, non-destructive)
2. `migrations.Run()` runs after - handles complex schema changes that AutoMigrate can't handle

This design ensures:
- New installations get the full schema immediately via AutoMigrate
- Existing installations get schema updates via migrations
- Migrations are idempotent (safe to run multiple times)

## Current Migrations

### V1: Add OTP fields to users table

**Added:** 2026-01-18

Adds three columns to the `users` table for two-factor authentication:
- `otp_secret` (TEXT): Stores the TOTP secret key
- `otp_enabled` (INTEGER): Boolean flag indicating if OTP is enabled
- `otp_backup_codes` (TEXT): JSON array of hashed backup codes

This migration is idempotent - it checks if columns exist before adding them.

## Creating New Migrations

To add a new migration:

1. Add a new `Migration` struct to the `migrations` slice in `migrations.go`:

```go
{
    Version:     2,
    Description: "Your migration description",
    Up:          migrateV2Up,
    Down:        migrateV2Down,
}
```

2. Implement the Up function:

```go
func migrateV2Up(db *gorm.DB) error {
    // Check if changes are needed
    if db.Migrator().HasColumn(&models.YourModel{}, "new_column") {
        log.Println("Migration V2: new_column already exists, skipping")
        return nil
    }
    
    // Apply changes
    if err := db.Exec("ALTER TABLE your_table ADD COLUMN new_column TEXT").Error; err != nil {
        return fmt.Errorf("failed to add new_column: %w", err)
    }
    
    log.Println("Migration V2: Successfully added new_column")
    return nil
}
```

3. Implement the Down function (for rollback):

```go
func migrateV2Down(db *gorm.DB) error {
    // Note: SQLite doesn't support DROP COLUMN
    // You may need to provide alternative rollback instructions
    log.Println("Migration V2 Down: Rollback instructions...")
    return nil
}
```

## Best Practices

1. **Always check before modifying**: Use `db.Migrator().HasColumn()` or `db.Migrator().HasTable()` to make migrations idempotent
2. **Handle errors gracefully**: Return descriptive errors that help diagnose issues
3. **Log progress**: Use `log.Println()` to provide visibility into what the migration is doing
4. **SQLite limitations**: Remember that SQLite doesn't support DROP COLUMN - plan accordingly
5. **Test thoroughly**: Test migrations on both new and existing databases
6. **Never modify old migrations**: Once a migration is released, create a new one instead

## Testing Migrations

To test a migration:

1. Create a test database with the old schema
2. Run the application and verify the migration succeeds
3. Check the `migration_histories` table to confirm it was recorded
4. Verify the schema changes are correct

Example:

```bash
# Create old database
sqlite3 test.db "CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);"

# Run application
DB_PATH=test.db ./hassh

# Check migration history
sqlite3 test.db "SELECT * FROM migration_histories;"

# Verify schema
sqlite3 test.db "PRAGMA table_info(users);"
```

## Rollback

To rollback the last migration:

```go
import "github.com/ThraaxSession/Hash/internal/migrations"

// In your code
if err := migrations.Rollback(database.DB); err != nil {
    log.Fatal(err)
}
```

**Note**: Rollback is not exposed via CLI in the current implementation and should be used carefully.

## Troubleshooting

### Migration fails with "duplicate column"

This usually means:
1. AutoMigrate already added the column (expected behavior)
2. The migration's idempotency check isn't working

Solution: Ensure your migration checks `db.Migrator().HasColumn()` before adding columns.

### Migration version not updating

Check the `migration_histories` table:

```sql
SELECT * FROM migration_histories ORDER BY version DESC;
```

If the migration ran but wasn't recorded, it likely failed after making changes but before recording the history.

## Schema Version

Current schema version: **1**

To check your database version:

```sql
SELECT MAX(version) as current_version FROM migration_histories;
```
