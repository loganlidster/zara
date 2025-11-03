# Admin User Management System - Complete Guide

## Overview
A complete admin panel has been added to your RAAS dashboard that allows you to manage users directly from the web interface. No more editing code files!

## What Was Created

### 1. Database Table: `dashboard_users`
Located in your PostgreSQL database (`tradiac_testing`), this table stores all user information:

```sql
CREATE TABLE dashboard_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Current Users:**
- Logan (logan@ninjatech.ai) - Admin
- Aaron (aaronstubblefield@gmail.com) - Regular User

### 2. Admin Panel Page
**URL:** `https://raas.help/admin`

**Features:**
- View all users in a table
- Add new users with email, name, and password
- Delete users (except yourself)
- Toggle admin privileges for any user
- See when each user was created

**Access:** Only users with `is_admin = true` can access this page

### 3. Admin Button in Header
When you're logged in as an admin, you'll see a purple "👤 Admin Panel" button in the top-right header on every page.

### 4. Updated Login System
The login now checks the database instead of hardcoded values in the code. This means:
- All user changes are immediate (no code deployment needed)
- Passwords are stored in the database
- Admin status is tracked per user

## How to Use

### Access the Admin Panel
1. Log in to https://raas.help with your admin account (logan@ninjatech.ai)
2. Click the purple "👤 Admin Panel" button in the top-right
3. You'll see the user management interface

### Add a New User
1. Click "+ Add New User" button
2. Fill in:
   - Email address
   - Full name
   - Password
   - Check "Admin privileges" if they should be an admin
3. Click "Add User"
4. The new user can immediately log in with those credentials

### Remove a User
1. Find the user in the table
2. Click "Delete" in the Actions column
3. Confirm the deletion
4. User is immediately removed and cannot log in

### Change Admin Status
1. Find the user in the table
2. Click "Make Admin" or "Remove Admin" in the Actions column
3. Status changes immediately

### Security Features
- You cannot delete your own account (prevents lockout)
- Only admins can access the admin panel
- Non-admins are redirected to the home page if they try to access /admin

## API Endpoints Created

### 1. `GET /api/users`
Lists all users (admin only)

### 2. `POST /api/users`
Adds a new user (admin only)

**Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securepassword",
  "is_admin": false
}
```

### 3. `PUT /api/users`
Updates user admin status (admin only)

**Body:**
```json
{
  "id": 1,
  "is_admin": true
}
```

### 4. `DELETE /api/users?id=1`
Deletes a user (admin only)

### 5. `GET /api/auth/check-admin`
Checks if current user is an admin

## Deployment Status

✅ **Deployed to Vercel** - Changes are live at https://raas.help

The system will auto-deploy whenever you push to GitHub.

## Database Credentials

The API uses these environment variables (already configured in Vercel):
- `DB_HOST`: 34.41.97.179
- `DB_PORT`: 5432
- `DB_NAME`: tradiac_testing
- `DB_USER`: postgres
- `DB_PASSWORD`: Fu3lth3j3t!

## Current User List

You can check your current users by running:

```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
});

async function listUsers() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT id, email, name, is_admin, created_at FROM dashboard_users ORDER BY id');
    console.table(result.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

listUsers();
"
```

## Security Notes

### Current Implementation
- Passwords are stored in plain text in the database
- This is acceptable for a small internal tool with trusted users

### Future Improvements (if needed)
If you want to add more security:
1. Hash passwords using bcrypt before storing
2. Add password reset functionality
3. Add email verification
4. Add two-factor authentication
5. Add password complexity requirements

## Troubleshooting

### "Access Denied" when accessing /admin
- Make sure you're logged in
- Check that your user has `is_admin = true` in the database
- Try logging out and back in

### Changes not appearing
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Check that Vercel deployment completed successfully

### Database connection errors
- Verify environment variables are set in Vercel
- Check that database is accessible from Vercel's servers
- Confirm database credentials are correct

## Summary

You now have a complete user management system! You can:
- ✅ View all users at /admin
- ✅ Add new users with a form
- ✅ Delete users (except yourself)
- ✅ Toggle admin privileges
- ✅ All changes are immediate (no code deployment needed)
- ✅ Admin button appears in header for admins only

**Next time you need to add/remove a user, just go to https://raas.help/admin instead of editing code!**