# User Management Guide - RAAS Dashboard

## Users Added

### Current Users:
1. **Logan**
   - Email: logan@ninjatech.ai
   - Password: (stored in DASHBOARD_PASSWORD environment variable)

2. **Aaron** ✅ NEW
   - Email: aaronstubblefield@gmail.com
   - Password: Wohler1

## Changes Made

### 1. Updated Login API (`frontend-dashboard/app/api/auth/login/route.ts`)
- Changed from single password to email + password authentication
- Added user database with multiple users
- Stores user name and email in cookies after login

### 2. Updated Login Page (`frontend-dashboard/app/login/page.tsx`)
- Added email field
- Updated to send both email and password
- Changed error message to "Invalid email or password"

## How to Add More Users

### Option 1: Edit the Code (Current Method)

Edit `frontend-dashboard/app/api/auth/login/route.ts`:

```typescript
const USERS = [
  {
    email: 'logan@ninjatech.ai',
    password: process.env.DASHBOARD_PASSWORD || 'tradiac2024',
    name: 'Logan'
  },
  {
    email: 'aaronstubblefield@gmail.com',
    password: 'Wohler1',
    name: 'Aaron'
  },
  // Add new user here:
  {
    email: 'newuser@example.com',
    password: 'SecurePassword123',
    name: 'New User'
  }
];
```

Then deploy to Vercel.

### Option 2: Use Environment Variables (Better for Security)

Instead of hardcoding passwords, you can use environment variables:

```typescript
const USERS = [
  {
    email: 'logan@ninjatech.ai',
    password: process.env.LOGAN_PASSWORD,
    name: 'Logan'
  },
  {
    email: 'aaronstubblefield@gmail.com',
    password: process.env.AARON_PASSWORD,
    name: 'Aaron'
  }
];
```

Then set in Vercel:
- `LOGAN_PASSWORD` = your password
- `AARON_PASSWORD` = Wohler1

## Deployment

### Deploy to Vercel:

```bash
cd frontend-dashboard
npx vercel --prod --token=zHtms0PFOh0aVswV1MbjzLr5 --yes
```

Or push to GitHub and it will auto-deploy.

## Testing

### Test Aaron's Login:
1. Go to https://raas.help
2. You'll be redirected to login page
3. Enter:
   - Email: aaronstubblefield@gmail.com
   - Password: Wohler1
4. Click "Login"
5. Should redirect to dashboard

### Test Logan's Login:
1. Go to https://raas.help
2. Enter:
   - Email: logan@ninjatech.ai
   - Password: (your current password)
3. Click "Login"
4. Should redirect to dashboard

## Security Notes

### Current Security Level: Basic
- Passwords stored in plain text in code
- No password hashing
- No rate limiting
- No account lockout

### For Production (Future Improvements):
1. **Move to Database:**
   - Store users in PostgreSQL
   - Hash passwords with bcrypt
   - Add user roles (admin, viewer)

2. **Add Security Features:**
   - Rate limiting (max 5 login attempts)
   - Account lockout after failed attempts
   - Password reset functionality
   - Two-factor authentication

3. **Add User Management:**
   - Admin panel to add/remove users
   - Change password functionality
   - User activity logs

## Quick Reference

### Current Users:
| Name  | Email                          | Password |
|-------|--------------------------------|----------|
| Logan | logan@ninjatech.ai             | (env var)|
| Aaron | aaronstubblefield@gmail.com    | Wohler1  |

### Login URL:
https://raas.help/login

### After Login:
- User name displayed in header
- Logout button available
- Access to all reports

## Future Enhancements

If you need more advanced user management:

1. **Database-backed users** - Store in PostgreSQL
2. **User roles** - Admin, Analyst, Viewer
3. **Permissions** - Control access to specific reports
4. **Audit logs** - Track who accessed what
5. **API keys** - For programmatic access
6. **SSO integration** - Google/Microsoft login

Let me know if you need any of these features!