# Hassh - Home Assistant Share 🏠

Hassh is a web service to share Home Assistant entities and dashboards with friends, family, and other users. Share links can be permanent or restricted by access count or time. Features include user management, entity sharing between users, and fine-grained access control.

## Features

- 🔗 **Share Home Assistant Entities**: Create shareable links for your Home Assistant entities
- 🔐 **Secure Authentication**: Username/password authentication with optional two-factor authentication (TOTP/OTP)
- 🔒 **Two-Factor Authentication**: Optional OTP-based 2FA with backup codes for enhanced account security
- 👥 **Multi-User Support**: Each user has their own entities and share links with admin management capabilities
- 🤝 **Entity Sharing Between Users**: Share entities directly with other registered users
- 🎯 **Access Control**: Choose between readonly and triggerable access modes
- ⏰ **Flexible Link Types**: 
  - Permanent links
  - Counter-based links (limited number of accesses)
  - Time-based links (expire after a certain time)
- 🔄 **Auto-refresh**: Entities automatically refresh when they change in Home Assistant
- 💾 **SQLite Persistence**: All data is stored persistently in SQLite database
- 🎨 **Modern UI**: Clean, responsive interface built with pure JavaScript
- 🚀 **Fast Backend**: Built with Go and Gin framework
- 👑 **Admin Panel**: Full user management with admin role assignment

## Prerequisites

- Home Assistant instance (for entity tracking)
- Nabu Casa Remote UI URL (or direct access URL) - configured per user
- Long-lived access token from Home Assistant - configured per user

**Note**: Each user configures their own Home Assistant URL and token in the application settings after registration or login.

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/ThraaxSession/Hassh.git
cd Hassh

# Build the application
go build -o hassh ./cmd/hassh

# Run the application
./hassh
```

## Configuration

Hassh can be configured using environment variables or by creating a `.env` file:

```bash
# Host to bind the server to (default: 0.0.0.0 - all interfaces)
# Examples:
#   HOST=0.0.0.0          # Listen on all interfaces (default)
#   HOST=localhost        # Listen on localhost only
#   HOST=192.168.1.10     # Listen on specific IP
export HOST="0.0.0.0"

# Port to run the server on (default: 8080)
export PORT="8080"

# Home Assistant URL (Optional - users can configure individually in settings)
# This can be set as a default, but users can override it
export HOME_ASSISTANT_URL="https://your-instance.ui.nabu.casa"

# Entity refresh interval in seconds (default: 30)
export REFRESH_INTERVAL="30"

# Database file path (default: hassh.db)
export DB_PATH="hassh.db"

# JWT secret for authentication (auto-generated if not provided)
export JWT_SECRET="your-secret-key"
```

### Example

```bash
export PORT="8080"
./hassh
```

The server will start on `http://localhost:8080`

## Usage

### First-Time Setup

When you first start Hassh, no admin user exists. The first user to register becomes the admin:

1. Navigate to `http://localhost:8080`
2. You will be redirected to the registration page (only available when no admin exists)
3. Enter a username to register
4. The system will generate a temporary password - **save it immediately**
5. Log in with the username and generated password
6. You will be prompted to change your password
7. After changing password, configure your Home Assistant connection in Settings

### Subsequent Users

After the first admin is created, new users must be created by the admin through the admin panel. Registration is disabled once an admin exists.

### Login

1. Navigate to `http://localhost:8080`
2. Enter your username and password
3. If 2FA is enabled, enter the 6-digit code from your authenticator app
4. Click "Login" (or "Verify" for 2FA)

### Enabling Two-Factor Authentication

To add an extra layer of security to your account:

1. Navigate to Settings (after logging in)
2. Scroll to the "Two-Factor Authentication (OTP)" section
3. Click "Enable 2FA"
4. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
   - Alternatively, you can manually enter the secret key shown
5. Enter your password and the 6-digit code from your authenticator app
6. Click "Verify & Enable"
7. **Important**: Save the backup codes displayed - these can be used if you lose access to your authenticator app
8. Each backup code can be used only once

To disable 2FA:
1. Navigate to Settings
2. Scroll to the "Two-Factor Authentication (OTP)" section
3. Click "Disable 2FA"
4. Enter your password to confirm

### Configuring Home Assistant

Each user must configure their own Home Assistant connection:

1. Navigate to Settings (after logging in)
2. Enter your Home Assistant URL (e.g., `https://your-instance.ui.nabu.casa`)
3. Enter your long-lived Home Assistant token
4. Click "Save"

#### Getting a Long-Lived Token

1. In Home Assistant, click on your profile (bottom left)
2. Scroll down to "Long-Lived Access Tokens"
3. Click "Create Token"
4. Give it a name and copy the token

### Adding Entities to Track

1. After logging in, you'll see the main dashboard
2. Click "Browse Entities" to see all available Home Assistant entities
3. Select an entity or manually enter the entity ID
4. Click "Add Entity" to start tracking it

### Sharing Entities with Other Users

You can share your entities directly with other registered users:

1. Go to your entity list
2. Click "Share" on the entity you want to share
3. Select the user to share with
4. Choose access mode:
   - **Readonly**: User can view the entity state
   - **Triggerable**: User can view and trigger actions on the entity
5. The shared entity will appear in their "Shared with Me" section

### Creating Share Links

1. In the "Share Links" section, select entities you want to share
2. Choose the access mode:
   - **Readonly**: Recipients can only view entity states
   - **Triggerable**: Recipients can view and trigger actions (like turning on/off lights)
3. Choose the link type:
   - **Permanent**: Link never expires
   - **Limited Access Count**: Link expires after N accesses
   - **Time-Limited**: Link expires at a specific date/time
4. Click "Create Share Link"
5. Copy the generated link and share it

### Accessing Shared Links

Share links follow the format: `http://localhost:8080/share/{link-id}`

Users can access these links to view the current state of shared entities. The entities will auto-refresh every 30 seconds.

For triggerable share links, users can interact with the entities (e.g., toggle lights, trigger switches) directly from the shared page.

**Note**: Shared links are public and do not require authentication.

### Admin Features

If you are an admin user, you have access to additional features:

1. **User Management**: 
   - Create new users with generated passwords
   - Delete users (except the last admin)
   - Promote/demote users to/from admin role
   
2. **View All Users**: Access the admin panel to see all registered users

3. **User Creation**: 
   - Create users with system-generated secure passwords
   - Passwords must be shared with the new user manually
   - New users are prompted to change their password on first login

## API Endpoints

### Public Endpoints

#### Authentication

- `POST /api/login` - Login with username and password
  ```json
  {
    "username": "your-username",
    "password": "your-password"
  }
  ```
  Returns: `{ "token": "jwt-token", "user": {...}, "is_admin": bool, "require_password_change": bool, "has_ha_config": bool, "otp_required": bool }`
  
  If OTP is enabled for the user, returns: `{ "otp_required": true, "message": "OTP verification required" }`

- `POST /api/verify-otp` - Verify OTP code during login
  ```json
  {
    "username": "your-username",
    "password": "your-password",
    "code": "123456"
  }
  ```
  Returns: `{ "token": "jwt-token", "user": {...}, "is_admin": bool, "require_password_change": bool, "has_ha_config": bool }`

- `POST /api/register` - Register first user (only available when no admin exists)
  ```json
  {
    "username": "your-username"
  }
  ```
  Returns: `{ "token": "jwt-token", "user": {...}, "generated_password": "...", "require_password_change": true }`

- `GET /api/admin-exists` - Check if admin user exists
  Returns: `{ "exists": bool }`

#### Share Links

- `GET /api/shares/:id` - Access shared entities (public, no auth required)
  Returns entity data with current states

- `POST /api/shares/:id/trigger/:entityId` - Trigger entity action via share link (for triggerable shares)
  ```json
  {
    "service": "turn_on",
    "data": {
      "brightness": 255
    }
  }
  ```

### Protected Endpoints (Require Authentication)

All protected endpoints require `Authorization: Bearer <token>` header.

#### User Settings

- `GET /api/settings` - Get current user settings
- `POST /api/settings/ha` - Configure Home Assistant connection
  ```json
  {
    "ha_url": "https://your-instance.ui.nabu.casa",
    "ha_token": "your-long-lived-token"
  }
  ```
- `POST /api/settings/password` - Change password
  ```json
  {
    "current_password": "old-password",
    "new_password": "new-password"
  }
  ```

#### Two-Factor Authentication (OTP)

- `POST /api/otp/setup` - Generate OTP secret and QR code
  Returns: `{ "secret": "...", "url": "otpauth://...", "qr_code": "data:image/png;base64,..." }`

- `POST /api/otp/enable` - Enable OTP after verification
  ```json
  {
    "password": "your-password",
    "secret": "otp-secret-from-setup",
    "code": "123456"
  }
  ```
  Returns: `{ "message": "OTP enabled successfully", "backup_codes": ["CODE1", "CODE2", ...] }`

- `POST /api/otp/disable` - Disable OTP
  ```json
  {
    "password": "your-password"
  }
  ```
  Returns: `{ "message": "OTP disabled successfully" }`

#### Entity Management

- `GET /api/entities` - List tracked entities
- `POST /api/entities` - Add entity to track
  ```json
  {
    "entity_id": "light.living_room"
  }
  ```
- `DELETE /api/entities/:id` - Remove entity from tracking
- `GET /api/ha/entities` - Fetch all available Home Assistant entities

#### Entity Sharing Between Users

- `POST /api/share-entity` - Share entity with another user
  ```json
  {
    "entity_id": "light.living_room",
    "shared_with_id": 2,
    "access_mode": "readonly"
  }
  ```
- `GET /api/shared-with-me` - Get entities shared with current user
- `GET /api/my-shares` - Get entities current user has shared with others
- `DELETE /api/shared-entity/:id` - Remove entity sharing

#### Share Link Management

- `POST /api/shares` - Create a share link
  ```json
  {
    "entity_ids": ["light.living_room", "sensor.temperature"],
    "type": "permanent|counter|time",
    "access_mode": "readonly|triggerable",
    "max_access": 10,
    "expires_at": "2026-12-31T23:59:59Z"
  }
  ```
- `GET /api/shares` - List all share links (user's own)
- `PUT /api/shares/:id` - Update a share link
- `DELETE /api/shares/:id` - Delete a share link

#### User List

- `GET /api/users/list` - Get list of users (for sharing purposes)

### Admin Endpoints (Require Admin Role)

- `GET /api/users` - List all users with details
- `POST /api/users` - Create new user
  ```json
  {
    "username": "new-username"
  }
  ```
  Returns: `{ "user": {...}, "generated_password": "...", "message": "..." }`
- `DELETE /api/users/:id` - Delete user (cannot delete last admin)
- `PUT /api/users/:id/admin` - Toggle admin status
  ```json
  {
    "is_admin": true
  }
  ```

## Architecture

- **Backend**: Go with Gin framework
- **Frontend**: Pure JavaScript with Ajax (no frameworks)
- **Database**: SQLite for persistent storage with versioned migrations
- **Authentication**: JWT tokens with optional two-factor authentication
- **Refresh**: Timer-based polling from Home Assistant
- **Migrations**: Automatic database schema upgrades prevent breaking changes

## Database Migrations

Hassh uses a versioned migration system to safely upgrade database schemas without breaking existing installations.

- **Automatic**: Migrations run automatically on startup
- **Versioned**: Each migration is tracked in the `migration_histories` table
- **Idempotent**: Safe to run multiple times
- **Non-destructive**: Existing data is preserved

For details on the migration system, see [`internal/migrations/README.md`](internal/migrations/README.md).

## Security Considerations

- **Authentication & Authorization**:
  - All user endpoints are protected with JWT authentication
  - User passwords are hashed using bcrypt
  - Two-factor authentication (OTP) available for enhanced security
  - OTP secrets stored encrypted and never exposed in API responses
  - Backup codes hashed using bcrypt before storage
  - Password verification required to enable/disable OTP
- **User Management**:
  - First registered user becomes admin automatically
  - Admin users can create and manage other users
  - Each user configures their own Home Assistant credentials
  - Home Assistant tokens are stored securely in the database (not exposed in API responses)
- **Best Practices**:
  - Use HTTPS in production
  - Enable two-factor authentication for all users
  - Consider rate limiting for shared links
  - Regularly review and clean up old share links
  - Use counter or time-based links instead of permanent ones when possible
- **Share Links**:
  - Share links are public by design - choose carefully what you share
  - Triggerable share links allow external control - use with caution
- **Admin Protection**:
  - Admin role is required to delete the last admin user (prevents lockout)
  - Generated passwords should be changed by users on first login

## Development

```bash
# Run in development mode
go run ./cmd/hassh/main.go

# Build for production
go build -o hassh ./cmd/hassh

# Run tests (if any)
go test ./...
```

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.
