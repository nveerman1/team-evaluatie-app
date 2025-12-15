# Azure AD Authentication Setup Guide

This document describes how to configure Office 365 Azure AD authentication for the Team Evaluatie App.

## Overview

The application supports two authentication methods:

1. **Azure AD (Office 365) Authentication** - Production authentication method using Microsoft OAuth
2. **Dev-login (X-User-Email header)** - Development-only authentication for local testing

## Azure AD Configuration

### Prerequisites

- Azure AD tenant (Office 365 organization)
- Admin access to Azure Portal to register applications
- School domain (e.g., `school.nl`)

### Step 1: Register Application in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure the application:
   - **Name**: Team Evaluatie App
   - **Supported account types**: Accounts in this organizational directory only (Single tenant)
   - **Redirect URI**: 
     - Type: Web
     - URI: `http://localhost:8000/api/v1/auth/azure/callback` (for development)
     - Add production URI when deploying: `https://your-domain.com/api/v1/auth/azure/callback`

### Step 2: Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add the following permissions:
   - `User.Read` - Read user profile
6. Click **Grant admin consent** (requires admin)

### Step 3: Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Add a description (e.g., "Production secret")
4. Select expiration period (recommended: 24 months)
5. Click **Add**
6. **IMPORTANT**: Copy the secret value immediately - it won't be shown again

### Step 4: Note Required Values

From the app registration **Overview** page, note:
- **Application (client) ID**
- **Directory (tenant) ID**

## Backend Configuration

### Environment Variables

Create or update `.env` file in the `backend` directory:

```bash
# Environment (set to "production" to disable dev-login)
NODE_ENV=development  # or "production"

# Azure AD Configuration
AZURE_AD_CLIENT_ID=your-client-id-here
AZURE_AD_TENANT_ID=your-tenant-id-here
AZURE_AD_CLIENT_SECRET=your-client-secret-here
AZURE_AD_REDIRECT_URI=http://localhost:8000/api/v1/auth/azure/callback

# Optional: Domain filtering (comma-separated list)
# Only users with emails from these domains can log in
AZURE_AD_ALLOWED_DOMAINS=school.nl,example.edu

# Optional: Custom scopes (comma-separated)
AZURE_AD_SCOPES=User.Read

# JWT Configuration
SECRET_KEY=your-very-secret-key-here-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### Install Dependencies

```bash
cd backend
pip install -r requirements-ci.txt
```

This will install `msal>=1.31.0` which is required for Azure AD authentication.

## Frontend Configuration

### Environment Variables

Create or update `.env.local` file in the `frontend` directory:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

For production:
```bash
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api/v1
NODE_ENV=production
```

## Authentication Flow

### Azure AD Login Flow

1. User clicks "Login met Office 365" button
2. User is redirected to `GET /api/v1/auth/azure?school_id={school_id}`
3. Backend redirects to Microsoft login page
4. User authenticates with Office 365 credentials
5. Microsoft redirects back to `GET /api/v1/auth/azure/callback?code={code}&state={state}`
6. Backend:
   - Exchanges code for access token
   - Fetches user profile from Microsoft Graph
   - Validates email domain (if configured)
   - Creates or updates user in database
   - Issues JWT token
7. Frontend receives JWT token and user information
8. JWT token is used for subsequent API requests

### Dev-login Flow (Development Only)

1. User enters email in dev-login form
2. Email is saved to localStorage
3. Frontend includes `X-User-Email` header in API requests
4. Backend validates email exists in database
5. User is authenticated

**Note**: Dev-login is automatically disabled when `NODE_ENV=production`

## User Provisioning

When a user logs in via Azure AD for the first time:

1. User profile is fetched from Microsoft Graph API
2. Email is validated against `AZURE_AD_ALLOWED_DOMAINS` (if configured)
3. A new user is created with:
   - `email`: from Azure AD profile
   - `name`: from Azure AD displayName
   - `role`: **student** (default)
   - `auth_provider`: azure_ad
   - `school_id`: from the OAuth flow state parameter

**Important**: New users are created with role `student` by default. Administrators must update user roles via the admin panel if needed.

## Role-Based Access Control (RBAC)

The application supports three roles:

- **student**: Can access student dashboards and evaluations
- **teacher**: Can create evaluations, view student data, manage courses
- **admin**: Full access to all features, user management

Roles are enforced via the `require_role()` function in `app/core/rbac.py`.

JWT tokens include role claims for efficient authorization.

## Multi-Tenant (School) Support

The application is multi-tenant at the school level:

- Each school has separate users, courses, evaluations, etc.
- School ID is passed during Azure AD login via `school_id` query parameter
- All queries are automatically scoped to the user's school via `scope_by_school()`
- JWT tokens include `school_id` claim

## Security Considerations

### Production Deployment

1. **Always set `NODE_ENV=production`** to disable dev-login
2. **Use HTTPS** for all endpoints, especially OAuth callback
3. **Secure client secret**: Use environment variables, never commit to git
4. **Rotate secrets regularly**: Azure AD client secrets should be rotated every 12-24 months
5. **Domain filtering**: Enable `AZURE_AD_ALLOWED_DOMAINS` to restrict access to specific email domains
6. **JWT secret**: Use a strong, randomly generated `SECRET_KEY`

### Token Expiration

- Azure AD tokens expire based on Azure AD tenant settings
- Application JWT tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 60 minutes)
- Users need to re-authenticate when tokens expire

## Troubleshooting

### "Azure AD authentication is not configured"

- Verify `AZURE_AD_CLIENT_ID` and `AZURE_AD_TENANT_ID` are set
- Check environment variables are loaded (restart backend after changes)

### "Email domain not allowed"

- User's email domain is not in `AZURE_AD_ALLOWED_DOMAINS`
- Add the domain to the allowed list or remove the restriction

### "Dev-login is only available in development mode"

- `NODE_ENV` is set to something other than "development"
- Use Azure AD login instead, or change `NODE_ENV` for local testing

### Redirect URI mismatch

- Azure AD redirect URI must exactly match `AZURE_AD_REDIRECT_URI`
- Update redirect URI in Azure Portal app registration

### User has wrong role

- New users are created with role "student" by default
- Admin must update role via admin panel or database

## Testing

### Local Development

1. Set `NODE_ENV=development`
2. Use dev-login for quick testing
3. Configure Azure AD with `http://localhost:8000/api/v1/auth/azure/callback` redirect URI

### Staging/Production

1. Set `NODE_ENV=production`
2. Configure Azure AD with production redirect URI
3. Test complete OAuth flow
4. Verify domain filtering works
5. Test role-based access control

## API Endpoints

### Azure AD Authentication

- `GET /api/v1/auth/azure?school_id={school_id}` - Initiate OAuth flow
- `GET /api/v1/auth/azure/callback?code={code}&state={state}` - OAuth callback

### User Information

- `GET /api/v1/auth/me` - Get current user information (requires authentication)

## Migration from Dev-login

If you have existing users using dev-login:

1. Set `auth_provider` to `azure_ad` for users that should use Azure AD
2. Ensure user emails match Office 365 emails
3. Users will be automatically updated when they first log in via Azure AD
4. Set `NODE_ENV=production` to force Azure AD authentication

## References

- [Microsoft Authentication Library (MSAL) for Python](https://github.com/AzureAD/microsoft-authentication-library-for-python)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/overview)
- [Azure AD OAuth 2.0 authorization code flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
