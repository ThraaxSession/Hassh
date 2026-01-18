# Hassh - Home Assistant Share 🏠

Hassh is a web service to share Home Assistant entities and dashboards with friends and family. Share links can be permanent or restricted by access count or time.

## Features

- 🔗 **Share Home Assistant Entities**: Create shareable links for your Home Assistant entities
- ⏰ **Flexible Link Types**: 
  - Permanent links
  - Counter-based links (limited number of accesses)
  - Time-based links (expire after a certain time)
- 🔄 **Auto-refresh**: Entities automatically refresh when they change in Home Assistant
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
# Home Assistant URL (Nabu Casa remote URL or local URL)
export HOME_ASSISTANT_URL="https://your-instance.ui.nabu.casa"

# Long-lived access token from Home Assistant
export HA_TOKEN="your-long-lived-token"

# Port to run the server on (default: 8080)
export PORT="8080"

# Entity refresh interval in seconds (default: 30)
export REFRESH_INTERVAL="30"
```

### Example

```bash
export HOME_ASSISTANT_URL="https://example.ui.nabu.casa"
export HA_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
./hassh
```

The server will start on `http://localhost:8080`

## Usage

### Adding Entities to Track

1. Open the web interface at `http://localhost:8080`
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

## API Endpoints

### Entity Management

- `GET /api/entities` - List tracked entities
- `POST /api/entities` - Add entity to track
  ```json
  {
    "entity_id": "light.living_room"
  }
  ```
- `DELETE /api/entities/:id` - Remove entity from tracking
- `GET /api/ha/entities` - Fetch all available Home Assistant entities

### Share Link Management

- `POST /api/shares` - Create a share link
  ```json
  {
    "entity_ids": ["light.living_room", "sensor.temperature"],
    "type": "permanent|counter|time",
    "max_access": 10,  // for counter type
    "expires_at": "2024-12-31T23:59:59Z"  // for time type
  }
  ```
- `GET /api/shares` - List all share links
- `GET /api/shares/:id` - Access shared entities
- `DELETE /api/shares/:id` - Delete a share link

## Architecture

- **Backend**: Go with Gin framework
- **Frontend**: Pure JavaScript with Ajax (no frameworks)
- **Storage**: In-memory (entities and share links)
- **Refresh**: Timer-based polling from Home Assistant

## Security Considerations

- Store your long-lived token securely
- Use HTTPS in production
- Consider rate limiting for shared links
- Regularly review and clean up old share links
- Use counter or time-based links instead of permanent ones when possible

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
