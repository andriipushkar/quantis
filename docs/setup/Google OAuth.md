# Google OAuth Setup

Step-by-step guide to enable "Sign in with Google" on Quantis.

## 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name: `Quantis` → **Create**
4. Make sure the new project is selected

## 2. Enable APIs

1. Go to **APIs & Services** → **Library**
2. Search for **Google Identity Services**
3. Click **Enable**

## 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** → **Create**
3. Fill in:
   - App name: `Quantis`
   - User support email: your email
   - Developer contact email: your email
4. Click **Save and Continue**
5. Scopes: click **Add or Remove Scopes**
   - Select `email` and `profile`
   - Click **Update** → **Save and Continue**
6. Test users: add your own Gmail → **Save and Continue**

## 4. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Quantis Web`
5. **Authorized JavaScript origins:**
   ```
   http://localhost:5173
   http://localhost:3001
   ```
   For production, also add:
   ```
   https://yourdomain.com
   ```
6. **Authorized redirect URIs:**
   ```
   http://localhost:5173/auth/google/callback
   http://localhost:3001/api/v1/auth/google
   ```
   For production:
   ```
   https://yourdomain.com/auth/google/callback
   ```
7. Click **Create**
8. Copy **Client ID** and **Client Secret**

## 5. Add to Environment Variables

Add these to your `.env` file (project root):

```env
# Google OAuth
GOOGLE_CLIENT_ID=123456789-xxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
VITE_GOOGLE_CLIENT_ID=123456789-xxxxxxx.apps.googleusercontent.com
```

> **Note:** `VITE_GOOGLE_CLIENT_ID` must be the same as `GOOGLE_CLIENT_ID`.
> The `VITE_` prefix makes it available to the frontend (Vite exposes only `VITE_` prefixed vars).

## 6. Run Database Migration

If you haven't already, apply the Google OAuth migration:

```bash
docker exec -i quantis-postgres psql -U quantis -d quantis < database/migrations/003_google_oauth.sql
```

## 7. Restart Services

```bash
# Kill running services
pkill -f "tsx|vite" 2>/dev/null

# Restart
npx concurrently "npm run dev:api" "npm run dev:collector" "npm run dev:analysis" "npm run dev:alerts" "npm run dev:client"
```

## 8. Verify

1. Open http://localhost:5173/login
2. You should see **"Sign in with Google"** button below the login form
3. Click it → Google sign-in popup → redirect to dashboard

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Button doesn't appear | Check `VITE_GOOGLE_CLIENT_ID` is set and restart Vite |
| "Invalid client" error | Verify Client ID matches in Google Console |
| "Redirect URI mismatch" | Add exact URI to Authorized redirect URIs in Console |
| "Access blocked: App not verified" | Normal for development — click "Continue" (Advanced) |
| Works in dev, fails in prod | Add production domain to Authorized origins + redirect URIs |

## How It Works

```
User clicks "Sign in with Google"
         ↓
Google Identity Services SDK shows popup
         ↓
User authorizes → Google returns ID token (JWT)
         ↓
Frontend sends token to POST /api/v1/auth/google
         ↓
Backend verifies token with Google's tokeninfo endpoint
         ↓
Creates new user or links to existing email account
         ↓
Returns JWT access + refresh tokens (same as email auth)
```

## Security Notes

- Google ID token is verified server-side (audience check matches GOOGLE_CLIENT_ID)
- Only verified emails are accepted
- OAuth users can't use password login (and vice versa until linked)
- Refresh token stored as httpOnly SameSite=Strict cookie
