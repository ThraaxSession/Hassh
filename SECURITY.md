# Security Documentation

## Endpoint Security

This document details the security configuration of all API endpoints in Hassh.

### Public Endpoints (No Authentication Required)

These endpoints are intentionally public and do not require JWT authentication:

1. **POST /api/login**
   - Purpose: Initial username/password authentication
   - Returns JWT token if credentials are valid (and OTP not enabled)
   - Returns `otp_required: true` if user has OTP enabled

2. **POST /api/verify-otp**
   - Purpose: OTP code verification during login
   - Required after /api/login returns `otp_required: true`
   - Accepts OTP codes (6 digits) or backup codes (8 characters)
   - Returns JWT token on successful verification

3. **POST /api/register**
   - Purpose: First user registration (becomes admin)
   - Only available when no admin user exists
   - Automatically disabled after first admin is created
   - Generates secure random password for the user

4. **GET /api/admin-exists**
   - Purpose: Check if an admin user exists
   - Used by frontend to determine if registration is available
   - No sensitive information exposed

5. **GET /api/shares/:id**
   - Purpose: Access publicly shared entities
   - By design - allows sharing entities with non-authenticated users
   - Share links are intentionally public for sharing functionality

6. **POST /api/shares/:id/trigger/:entityId**
   - Purpose: Trigger actions on entities via public share links
   - Only works for shares with `access_mode: "triggerable"`
   - By design - allows external control of shared entities

### Protected Endpoints (JWT Authentication Required)

All endpoints under the `/api` path that are not listed above require JWT authentication via the `AuthMiddleware`. The JWT token must be provided in the `Authorization` header as a Bearer token:

```
Authorization: Bearer <jwt-token>
```

#### User Settings & Configuration
- `GET /api/settings` - Get current user settings
- `POST /api/settings/ha` - Configure Home Assistant connection
- `POST /api/settings/password` - Change password

#### OTP Management
- `POST /api/otp/setup` - Generate OTP secret and QR code
- `POST /api/otp/enable` - Enable OTP with verification
- `POST /api/otp/disable` - Disable OTP (requires password)

#### Entity Management
- `GET /api/entities` - List user's tracked entities
- `POST /api/entities` - Add entity to track
- `DELETE /api/entities/:id` - Remove entity from tracking
- `GET /api/ha/entities` - Fetch all available Home Assistant entities

#### Entity Sharing (User-to-User)
- `POST /api/share-entity` - Share entity with another user
- `GET /api/shared-with-me` - Get entities shared with current user
- `GET /api/my-shares` - Get entities current user has shared
- `DELETE /api/shared-entity/:id` - Remove entity sharing

#### Share Link Management
- `POST /api/shares` - Create a share link
- `GET /api/shares` - List user's share links
- `PUT /api/shares/:id` - Update a share link
- `DELETE /api/shares/:id` - Delete a share link

#### User List
- `GET /api/users/list` - Get list of users for sharing purposes

### Admin Endpoints (JWT + Admin Role Required)

These endpoints require both JWT authentication and admin role via the `AdminMiddleware`:

- `GET /api/users` - List all users with details
- `POST /api/users` - Create new user (admin only)
- `DELETE /api/users/:id` - Delete user (cannot delete last admin)
- `PUT /api/users/:id/admin` - Toggle admin status

## Two-Factor Authentication (OTP)

### Implementation Details

- **Algorithm**: TOTP (Time-based One-Time Password)
- **Library**: pquerna/otp
- **QR Code Generation**: Server-side using skip2/go-qrcode
- **Backup Codes**: 10 per user, bcrypt hashed, single-use
- **Secret Storage**: Encrypted in database, never exposed in API responses

### Security Features

1. **Password Required**: Users must provide password to enable/disable OTP
2. **Verification Required**: OTP code must be verified before enabling
3. **Backup Codes**: Generated and shown once during setup
4. **Server-side Validation**: All OTP/backup codes validated server-side
5. **No External Dependencies**: QR codes generated locally (no third-party API exposure)

### Login Flow with OTP

1. User submits username and password to `/api/login`
2. If OTP is disabled: Token returned immediately
3. If OTP is enabled: Response indicates `otp_required: true`
4. User submits OTP code to `/api/verify-otp`
5. On successful verification: Token returned

## Best Practices

### For Developers

1. **Always use AuthMiddleware** for endpoints that access user data
2. **Use AdminMiddleware** for administrative functions
3. **Never expose secrets** in API responses (use `json:"-"` tag)
4. **Hash sensitive data** (passwords, backup codes) using bcrypt
5. **Validate input** on all endpoints

### For Users

1. **Enable 2FA** for enhanced account security
2. **Save backup codes** in a secure location
3. **Use HTTPS** in production environments
4. **Change default passwords** immediately
5. **Regular security audits** of share links

### For Administrators

1. **Require password changes** for newly created users
2. **Regular reviews** of user access and permissions
3. **Monitor share links** and revoke unused ones
4. **Keep software updated** to receive security patches
5. **Use strong JWT secrets** in production

## Threat Model

### Mitigated Threats

- ✅ Unauthorized access to user data (JWT authentication)
- ✅ Password compromise (2FA with OTP)
- ✅ Session hijacking (JWT expiration)
- ✅ Password attacks (bcrypt hashing)
- ✅ OTP secret exposure (server-side QR generation)
- ✅ Backup code reuse (single-use, hashed storage)

### Known Limitations

- ⚠️ Share links are public by design (feature, not a bug)
- ⚠️ JWT tokens stored in localStorage (XSS vulnerability risk)
- ⚠️ No rate limiting implemented yet
- ⚠️ No password complexity requirements enforced

### Future Enhancements

- [ ] Implement rate limiting on authentication endpoints
- [ ] Add password complexity requirements
- [ ] Session management and token revocation
- [ ] Audit logging for security events
- [ ] IP-based access restrictions
- [ ] WebAuthn/FIDO2 support

## Compliance

- **OWASP Top 10**: Addressed most common web vulnerabilities
- **Password Storage**: bcrypt with default cost factor
- **Session Management**: JWT with 24-hour expiration
- **Access Control**: Role-based (user/admin)

## Reporting Security Issues

If you discover a security vulnerability, please report it to the repository maintainers. Do not publicly disclose security issues.

## Security Audit History

- **2026-01-18**: Initial security review and 2FA implementation
  - CodeQL Scan: 0 alerts (Go: 0, JavaScript: 0)
  - Dependency Scan: No vulnerabilities found
  - Manual Code Review: All feedback addressed
