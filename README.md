# Hassh - Home Assistant Share 🏠

Hassh is a web service to share Home Assistant entities and dashboards with friends and family. Share links can be permanent or restricted by access count or time.

## Features

- 🔗 **Share Home Assistant Entities**: Create shareable links for your Home Assistant entities
- 🔐 **Authentication**: Secure login using Home Assistant tokens (no registration required)
- 👥 **Multi-User Support**: Each user has their own entities and share links
- ⏰ **Flexible Link Types**: 
  - Permanent links
  - Counter-based links (limited number of accesses)
  - Time-based links (expire after a certain time)
- 🔄 **Auto-refresh**: Entities automatically refresh when they change in Home Assistant
- 💾 **SQLite Persistence**: All data is stored persistently in SQLite database
- 🎨 **Modern UI**: Clean, responsive interface built with pure JavaScript
- 🚀 **Fast Backend**: Built with Go and Gin framework

## Prerequisites

- Home Assistant instance
- Nabu Casa Remote UI URL (or direct access URL)
- Long-lived access token from Home Assistant

### Getting a Long-Lived Token

1. In Home Assistant, click on your profile (bottom left)
2. Scroll down to "Long-Lived Access Tokens"
3. Click "Create Token"
4. Give it a name and copy the token

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/ThraaxSession/Hash.git
cd Hash

# Build the application
go build -o hassh ./cmd/hassh

# Run the application
./hassh
```

## Configuration

Hassh can be configured using environment variables:

```bash
# Home Assistant URL (Nabu Casa remote URL or local URL) - Optional, users can provide during login
export HOME_ASSISTANT_URL="https://your-instance.ui.nabu.casa"

# Port to run the server on (default: 8080)
export PORT="8080"

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

### Login

1. Navigate to `http://localhost:8080`
2. You will be redirected to the login page
3. Enter your username, Home Assistant URL, and long-lived token
4. Click "Login"

**Note**: No registration is required. Your Home Assistant token is validated on login, and your account is automatically created or updated.

### Adding Entities to Track

1. After logging in, you'll see the main dashboard
2. Click "Browse Entities" to see all available Home Assistant entities
3. Select an entity or manually enter the entity ID
4. Click "Add Entity" to start tracking it

### Creating Share Links

1. In the "Share Links" section, select entities you want to share
2. Choose the link type:
   - **Permanent**: Link never expires
   - **Limited Access Count**: Link expires after N accesses
   - **Time-Limited**: Link expires at a specific date/time
3. Click "Create Share Link"
4. Copy the generated link and share it

### Accessing Shared Links

Share links follow the format: `http://localhost:8080/share/{link-id}`

Users can access these links to view the current state of shared entities. The entities will auto-refresh every 30 seconds.

**Note**: Shared links are public and do not require authentication.

## API Endpoints

### Authentication

- `POST /api/login` - Login with Home Assistant credentials
  ```json
  {
    "username": "your-username",
    "ha_url": "https://your-instance.ui.nabu.casa",
    "ha_token": "your-long-lived-token"
  }
  ```
  Returns: `{ "token": "jwt-token", "user": {...} }`

### Entity Management (Protected)

All entity endpoints require authentication via `Authorization: Bearer <token>` header.

- `GET /api/entities` - List tracked entities
- `POST /api/entities` - Add entity to track
  ```json
  {
    "entity_id": "light.living_room"
  }
  ```
- `DELETE /api/entities/:id` - Remove entity from tracking
- `GET /api/ha/entities` - Fetch all available Home Assistant entities

### Share Link Management (Protected)

- `POST /api/shares` - Create a share link
  ```json
  {
    "entity_ids": ["light.living_room", "sensor.temperature"],
    "type": "permanent|counter|time",
    "max_access": 10,  // for counter type
    "expires_at": "2024-12-31T23:59:59Z"  // for time type
  }
  ```
- `GET /api/shares` - List all share links (user's own)
- `GET /api/shares/:id` - Access shared entities (public, no auth required)
- `DELETE /api/shares/:id` - Delete a share link

## Architecture

- **Backend**: Go with Gin framework
- **Frontend**: Pure JavaScript with Ajax (no frameworks)
- **Database**: SQLite for persistent storage
- **Authentication**: JWT tokens with Home Assistant token validation
- **Refresh**: Timer-based polling from Home Assistant

## Security Considerations

- All user endpoints are protected with JWT authentication
- Home Assistant tokens are validated on login
- Tokens are stored securely in the database
- Use HTTPS in production
- Consider rate limiting for shared links
- Regularly review and clean up old share links
- Use counter or time-based links instead of permanent ones when possible
- Share links are public by design - choose carefully what you share

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

See LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.
