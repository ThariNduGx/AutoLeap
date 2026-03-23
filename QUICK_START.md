# 🚀 Quick Start Guide

## 📋 Table of Contents

1. [Step 1: Database Migrations](#step-1-database-migrations)
2. [Step 2: Environment Variables](#step-2-environment-variables)
3. [Step 3: Start the Dev Server](#step-3-start-the-dev-server)
4. [Step 4: Login as Admin](#step-4-login-as-admin)
5. [Step 5: View Businesses](#step-5-view-businesses)
6. [Step 6: Test Business User Flow](#step-6-test-business-user-flow)
7. [Where is the Facebook Connect Button?](#where-is-the-facebook-connect-button)
8. [Security Features](#security-features)
9. [Testing Checklist](#testing-checklist)
10. [Troubleshooting](#troubleshooting)
    - ["Unauthorized" when accessing admin routes](#unauthorized-when-accessing-admin-routes)
    - [Facebook button doesn't work](#facebook-button-doesnt-work)
    - [Database errors](#database-errors)
11. [Default Accounts](#default-accounts)
12. [Next Steps](#next-steps)

---

## Step 1: Database Migrations

Run these two migrations in your Supabase dashboard (SQL Editor):

1. `supabase/migrations/20260119_add_facebook_messenger_fields.sql`
2. `supabase/migrations/20260119_add_user_roles_and_business_link.sql`

Or via CLI:
```bash
supabase db push
```

---

## Step 2: Environment Variables

Add to `.env.local`:

```bash
# JWT Secret (REQUIRED - Use a strong random string!)
JWT_SECRET="change-this-to-a-long-random-string-minimum-32-characters"

# Facebook App Secret (from Facebook Developer Console)
FB_APP_SECRET="your_facebook_app_secret"

# Webhook Verify Token (create your own random string)
FB_VERIFY_TOKEN="your_custom_verify_token"

# Facebook App ID (PUBLIC - for frontend SDK)
NEXT_PUBLIC_FACEBOOK_APP_ID="your_facebook_app_id"
```

---

## Step 3: Start the Dev Server

```bash
npm run dev
```

---

## Step 4: Login as Admin

Navigate to: `http://localhost:3000/auth/login`

**Default Admin Credentials:**
- Email: `admin@autoleap.com`
- Password: `AdminPass123!`

You'll be redirected to `/admin`

**⚠️ IMPORTANT: Change this password immediately!**

---

## Step 5: View Businesses

Click "Businesses" in admin sidebar to see all onboarded businesses.

---

## Step 6: Test Business User Flow

1. Create a business user (or login with existing)
2. Login → Redirected to `/dashboard`
3. Click "Settings" in sidebar
4. See "Integrations" section
5. Click "Connect Facebook Page"
6. Facebook popup → Select page
7. Success! Page connected

---

## Where is the Facebook Connect Button?

**PATH:** `/dashboard/settings`

**SECTION:** Integrations → Facebook Messenger

Business users will see a "Connect Facebook Page" button that:
1. Opens Facebook Login SDK
2. Asks for page permissions
3. Exchanges user token for Page Access Token
4. Saves to database
5. Subscribes page to webhooks
6. Shows "Connected" status

---

## Security Features

✅ HTTP-only cookies  
✅ JWT sessions (7-day expiry)  
✅ Role-based access control  
✅ Middleware route protection  
✅ Admin cannot access business routes  
✅ Business cannot access admin routes  
✅ Business users isolated to their own data  
✅ Session-based business ID (not from request body)  

---

## Testing Checklist

- [ ] Run database migrations
- [ ] Add environment variables
- [ ] Login as admin → See admin dashboard
- [ ] View businesses list
- [ ] Try accessing `/dashboard` as admin → Redirected back
- [ ] Login as business → See business dashboard
- [ ] Try accessing `/admin` as business → Redirected back
- [ ] Go to settings → See Facebook connect button
- [ ] Connect Facebook page (needs valid FB_APP_ID)
- [ ] Verify page appears as "Connected"

---

## Troubleshooting

### "Unauthorized" when accessing admin routes
- Check if you're logged in as admin user
- Check middleware is working (`src/middleware.ts`)
- Check JWT_SECRET is set

### Facebook button doesn't work
- Ensure `NEXT_PUBLIC_FACEBOOK_APP_ID` is set
- Check Facebook App is set up correctly
- Check required permissions are granted

### Database errors
- Ensure both migrations ran successfully
- Check Supabase connection string
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set

---

## Default Accounts

**Admin:**
- Email: `admin@autoleap.com`
- Password: `AdminPass123!`
- Role: `admin`
- Access: `/admin/*`

**Business Users:**
- Created via signup or manually
- Role: `business`
- Access: `/dashboard/*`

---

## Next Steps

1. ✅ Change default admin password
2. ✅ Add your Facebook App ID
3. ✅ Create actual business users
4. ✅ Test Facebook page connection
5. ✅ Deploy to production
6. ✅ Update webhook URL in Facebook App settings

---

For detailed implementation details, see `IMPLEMENTATION_SUMMARY.md`
