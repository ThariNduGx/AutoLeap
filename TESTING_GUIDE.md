# 🧪 Complete Testing Guide - Test Your Product

## Prerequisites

Before you start testing, make sure:
- ✅ `npm run dev` is running on `localhost:3000`
- ✅ Database migrations are applied
- ✅ Environment variables are set

---

## Step 1: Create a Test Business User

### Option A: Via Signup (Recommended)
1. Go to `http://localhost:3000/auth/signup`
2. Fill in:
   - Email: `testbusiness@example.com`
   - Password: `Test123!`
   - Name: `Test Business`
3. Click "Sign Up"

### Option B: Via Database (Quick)
Run this SQL in Supabase:

```sql
-- Create a test business
INSERT INTO public.businesses (name)
VALUES ('Test Business')
RETURNING id;

-- Copy the business ID, then create a user
INSERT INTO public.users (email, password_hash, name, role, business_id)
VALUES (
    'testbusiness@example.com',
    '$2b$10$9K/yNkeDNH2Jls8iuYmM6uZuUoW8H/XNPoAlwiGeRDg43a9ydtfwy', -- Password: Test123!
    'Test Business Owner',
    'business',
    'PASTE_BUSINESS_ID_HERE'
);
```

---

## Step 2: Login as Business User

1. Go to `http://localhost:3000/auth/login`
2. Enter:
   - Email: `testbusiness@example.com`
   - Password: `Test123!`
3. Click "Sign In"
4. ✅ You should be redirected to `/dashboard`

---

## Step 3: Test Telegram Integration

### 3.1 Expose Your Local Server (Required)

Telegram needs a public URL for webhooks. Use **ngrok**:

```bash
# Install ngrok (if not installed)
# Download from: https://ngrok.com/download

# Run ngrok
ngrok http 3000
```

You'll get a URL like: `https://xxxx-xxx-xxx-xxx.ngrok-free.app`

### 3.2 Update Environment Variable

Add to your `.env.local`:

```bash
NEXT_PUBLIC_BASE_URL="https://xxxx-xxx-xxx-xxx.ngrok-free.app"
```

Restart your dev server:
```bash
# Stop npm run dev (Ctrl+C)
# Start again
npm run dev
```

### 3.3 Create a Test Telegram Bot

1. Open Telegram app
2. Search for `@BotFather`
3. Send: `/newbot`
4. Follow prompts:
   - Bot name: `My Test Bot`
   - Username: `mytestbot123_bot` (must end with _bot)
5. Copy the **bot token** (looks like: `123456:ABC-DEF...`)

### 3.4 Connect Telegram Bot in Dashboard

1. In your browser (still logged in)
2. Go to **Settings** (click in sidebar)
3. Find **"Telegram Bot"** section
4. Click **"Get Started"**
5. Paste your bot token
6. Click **"Connect Bot"**
7. ✅ Should show "Connected"

### 3.5 Test Telegram Messages

1. Open Telegram
2. Search for your bot (e.g., `@mytestbot123_bot`)
3. Click **"START"**
4. Send a message: `Hello, what are your prices?`
5. Check your terminal (where `npm run dev` is running)
   - You should see webhook logs
6. ✅ Bot should respond (if you have FAQs set up)

---

## Step 4: Test Facebook Messenger Integration

### 4.1 Create Facebook App (One-time Setup)

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **"My Apps"** → **"Create App"**
3. Select **"Business"** type
4. Fill in app name: `AutoLeap Test`
5. Add **"Messenger"** product
6. Copy your **App ID** and **App Secret**

### 4.2 Update Environment Variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_FACEBOOK_APP_ID="your_app_id_here"
FB_APP_SECRET="your_app_secret_here"
FB_VERIFY_TOKEN="my-random-verify-token-12345"
```

Restart dev server.

### 4.3 Configure Webhooks in Facebook

1. In Facebook App Dashboard
2. Go to **Messenger** → **Settings**
3. Under **Webhooks**, click **"Add Callback URL"**
4. Enter:
   - **Callback URL:** `https://xxxx.ngrok-free.app/api/webhooks/messenger`
   - **Verify Token:** `my-random-verify-token-12345` (same as .env)
5. Click **"Verify and Save"**
6. Subscribe to: `messages`, `messaging_postbacks`

### 4.4 Create a Test Facebook Page

1. Go to [facebook.com/pages/create](https://www.facebook.com/pages/create)
2. Create a page for testing (e.g., "Test Business Page")
3. Go to page settings → **Messenger Platform**
4. Make sure Messenger is enabled

### 4.5 Connect Facebook Page in Dashboard

1. In your browser (logged in as business user)
2. Still on **Settings** page
3. Find **"Facebook Messenger"** section
4. Click **"Connect Facebook Page"**
5. Facebook popup appears
6. Login (if needed)
7. Select your test page
8. Click "Continue"
9. ✅ Should show "Connected" with page name

### 4.6 Test Facebook Messages

1. Go to your Facebook Page
2. Click **"Send Message"** (as if you're a customer)
3. Send a message: `Hi, what are your hours?`
4. Check your terminal logs
5. ✅ Should receive webhook event

---

## Step 5: Add Test FAQs

For the bot to respond, add some FAQs:

1. Go to **FAQs** in sidebar
2. Click **"Add FAQ"**
3. Add sample FAQs:

**FAQ 1:**
- Question: `What are your prices?`
- Answer: `Our prices start at $50 for basic service.`
- Category: `pricing`

**FAQ 2:**
- Question: `What are your hours?`
- Answer: `We're open Monday-Friday, 9 AM to 5 PM.`
- Category: `general`

**FAQ 3:**
- Question: `Where are you located?`
- Answer: `We're located at 123 Main Street, City.`
- Category: `location`

---

## Step 6: Test End-to-End Flow

### Test with Telegram:
1. Send: `What are your prices?`
2. ✅ Should get AI response based on FAQ
3. Send: `Tell me about your hours`
4. ✅ Should get hours FAQ

### Test with Facebook:
1. Send message to page
2. ✅ Should get AI response

---

## Step 7: Test as Admin

### 7.1 Update Admin Password (if needed)

Run in Supabase:
```sql
UPDATE public.users
SET password_hash = '$2b$10$9K/yNkeDNH2Jls8iuYmM6uZuUoW8H/XNPoAlwiGeRDg43a9ydtfwy'
WHERE email = 'admin@autoleap.com';
```

### 7.2 Login as Admin

1. Logout from business account
2. Go to `http://localhost:3000/auth/login`
3. Login with:
   - Email: `admin@autoleap.com`
   - Password: `AdminPass123!`
4. ✅ Should redirect to `/admin` (red theme)

### 7.3 View All Businesses

1. Click **"Businesses"** in sidebar
2. ✅ Should see your test business
3. ✅ Should see connection status:
   - Telegram: ✓ Connected
   - Facebook: ✓ Connected
4. ✅ Should see FAQ count

---

## Troubleshooting

### Issue: Telegram webhook not working
**Solution:**
- Check ngrok is running
- Verify `NEXT_PUBLIC_BASE_URL` is set correctly
- Check terminal logs for errors
- Test webhook manually:
  ```bash
  curl https://your-ngrok-url.ngrok-free.app/api/webhooks/telegram
  ```

### Issue: Facebook webhook verification fails
**Solution:**
- Check `FB_VERIFY_TOKEN` matches in both .env and Facebook
- Make sure ngrok URL is accessible
- Check terminal logs

### Issue: Bot doesn't respond
**Solution:**
- Check FAQs are added
- Check queue processor is running
- Look at database `request_queue` table:
  ```sql
  SELECT * FROM public.request_queue ORDER BY created_at DESC LIMIT 10;
  ```

### Issue: Login fails
**Solution:**
- Check password hash in database
- Run update-admin-password.sql
- Check terminal logs for error messages

---

## Quick Test Checklist

- [ ] Created test business user
- [ ] Logged in successfully
- [ ] Settings page loads
- [ ] Created Telegram bot
- [ ] Connected Telegram bot
- [ ] Telegram shows "Connected"
- [ ] Created Facebook app
- [ ] Connected Facebook page
- [ ] Facebook shows "Connected"
- [ ] Added test FAQs
- [ ] Sent test message to Telegram bot
- [ ] Sent test message to Facebook page
- [ ] Logged in as admin
- [ ] Viewed businesses list
- [ ] Saw connection statuses

---

## Environment Variables Summary

Your `.env.local` should have:

```bash
# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"

# JWT
JWT_SECRET="your-super-secret-key-minimum-32-characters"

# Base URL (for webhooks)
NEXT_PUBLIC_BASE_URL="https://your-ngrok-url.ngrok-free.app"

# Telegram
TELEGRAM_BOT_TOKEN="your-webhook-secret-token"

# Facebook
NEXT_PUBLIC_FACEBOOK_APP_ID="your_facebook_app_id"
FB_APP_SECRET="your_facebook_app_secret"
FB_VERIFY_TOKEN="my-random-verify-token-12345"
```

---

## Testing Video Flow

1. **Record yourself:**
   - Creating a business account
   - Connecting Telegram (show the ease)
   - Connecting Facebook (one-click!)
   - Adding FAQs
   - Sending messages
   - Getting AI responses

2. **Show admin view:**
   - Dashboard stats
   - Businesses list
   - Integration statuses

This makes great demo content for your product! 🎥

---

**You're ready to test! The full flow should take about 15-20 minutes.** 🚀
