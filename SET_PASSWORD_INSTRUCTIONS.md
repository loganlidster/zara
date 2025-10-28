# Set Dashboard Password in Vercel

## ✅ Code Deployed
Authentication code has been pushed to GitHub and Vercel will automatically deploy it.

---

## Next Step: Set Your Password

### Instructions:

1. **Go to Vercel Project Settings**
   - Visit: https://vercel.com/logans-projects-57bfdedc/zara-report/settings/environment-variables

2. **Add Environment Variable**
   - Click **"Add New"** button
   - **Key:** `DASHBOARD_PASSWORD`
   - **Value:** (enter your desired password - e.g., `MySecurePass123!`)
   - **Environment:** Select all three: Production, Preview, Development
   - Click **"Save"**

3. **Redeploy**
   - Go to: https://vercel.com/logans-projects-57bfdedc/zara-report/deployments
   - Click the three dots (...) on the latest deployment
   - Click **"Redeploy"**
   - Wait ~1 minute for deployment to complete

---

## Default Password (Temporary)

If you don't set the environment variable, the default password is:
- **Password:** `tradiac2024`

**⚠️ Important:** Change this by setting the `DASHBOARD_PASSWORD` environment variable!

---

## How It Works

Once deployed:
1. **Visit your dashboard** - You'll be redirected to the login page
2. **Enter password** - Use the password you set in Vercel
3. **Access reports** - You'll stay logged in for 7 days
4. **Logout** - Click the "Logout" button in the header anytime

---

## Password Security Tips

✅ Use a strong password (mix of letters, numbers, symbols)
✅ Don't share the password publicly
✅ Change it periodically
✅ You can change it anytime in Vercel settings (no code changes needed)

---

## Testing

After setting the password and redeploying:
1. Visit your dashboard URL
2. You should see the login page
3. Enter your password
4. You should be redirected to the home page
5. Test the logout button

---

## Need to Change Password Later?

Just go back to Vercel Environment Variables, update the value, and redeploy. No code changes needed!