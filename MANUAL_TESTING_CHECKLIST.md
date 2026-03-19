# 🧪 AutoLeap - Manual Testing Checklist

## Pre-Testing Setup

### Environment Check
- [ ] `npm run dev` is running on `localhost:3000`
- [ ] Database is connected (check Supabase)
- [ ] `.env.local` has all required variables:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `JWT_SECRET`
  - [ ] `TELEGRAM_BOT_TOKEN` (webhook secret)
  - [ ] `GOOGLE_API_KEY` (for AI responses)
  - [ ] For Facebook testing:
    - [ ] `NEXT_PUBLIC_FACEBOOK_APP_ID`
    - [ ] `FB_APP_SECRET`
    - [ ] `FB_VERIFY_TOKEN`
  - [ ] For Webhooks:
    - [ ] `NEXT_PUBLIC_BASE_URL` (ngrok URL for local testing)

### Required Tools
- [ ] **ngrok** installed ([download](https://ngrok.com/download))
- [ ] **Telegram** app (mobile or desktop)
- [ ] **Facebook account** with admin access to a page
- [ ] **Browser** (Chrome recommended)
- [ ] **Postman** or similar (optional, for API testing)

---

## Section 1: Database & Authentication Testing

### 1.1 Test Database Connection
```bash
# In terminal
cd "d:\New Files\Personal\Web Projects\AutoLeap"
npm run dev
```

**Expected Result:**
- [ ] Server starts without errors
- [ ] Console shows: `Ready in XXXms`
- [ ] No database connection errors

### 1.2 Test User Signup
**Steps:**
1. [ ] Go to `http://localhost:3000/auth/signup`
2. [ ] Fill in:
   - Email: `testbiz@example.com`
   - Password: `Test123!`
   - Business Name: `Test Business`
3. [ ] Click "Sign Up"

**Expected Result:**
- [ ] No errors in browser console
- [ ] Redirected to login page OR dashboard
- [ ] User created in database

**Verify in Database:**
```sql
SELECT * FROM public.users WHERE email = 'testbiz@example.com';
SELECT * FROM public.businesses WHERE name = 'Test Business';
```

### 1.3 Test Login
**Steps:**
1. [ ] Go to `http://localhost:3000/auth/login`
2. [ ] Enter:
   - Email: `testbiz@example.com`
   - Password: `Test123!`
3. [ ] Click "Sign In"

**Expected Result:**
- [ ] Redirected to `/dashboard`
- [ ] Dashboard loads successfully
- [ ] Sidebar shows: FAQs, Settings, etc.

---

## Section 2: Telegram Bot Testing

### 2.1 Setup ngrok (Required for Webhooks)
**In a NEW terminal:**
```bash
ngrok http 3000
```

**Expected Result:**
- [ ] ngrok shows a URL like: `https://xxxx-xx-xxx-xxx.ngrok-free.app`
- [ ] Copy this URL

**Update `.env.local`:**
```bash
NEXT_PUBLIC_BASE_URL="https://xxxx-xx-xxx-xxx.ngrok-free.app"
```

**Restart dev server:**
```bash
# Stop (Ctrl+C) and restart
npm run dev
```

### 2.2 Create Test Telegram Bot
**In Telegram:**
1. [ ] Search for `@BotFather`
2. [ ] Send: `/newbot`
3. [ ] Bot name: `AutoLeap Test Bot`
4. [ ] Username: `autoleap_test_[yourname]_bot` (must be unique)
5. [ ] Copy the **bot token** (format: `123456:ABC-DEF...`)

**Expected Result:**
- [ ] BotFather confirms bot creation
- [ ] You receive a bot token
- [ ] Bot username is unique

### 2.3 Connect Telegram Bot via UI
**In Browser (logged in):**
1. [ ] Go to Settings (`/dashboard/settings`)
2. [ ] Find "Telegram Bot" section
3. [ ] Shows "Not Connected"
4. [ ] Click "Get Started"
5. [ ] Instructions appear
6. [ ] Paste bot token
7. [ ] Click "Connect Bot"

**Expected Result:**
- [ ] Loading spinner appears
- [ ] Success message shows
- [ ] Status changes to "Connected ✓"
- [ ] Bot username displays
- [ ] "Disconnect" button appears

**Verify in Database:**
```sql
SELECT telegram_bot_token, telegram_bot_username 
FROM public.businesses 
WHERE name = 'Test Business';
```

**Check Terminal Logs:**
- [ ] No errors
- [ ] Shows API call to `/api/telegram/connect`
- [ ] Response: 200 OK

### 2.4 Test Telegram Webhook
**In Telegram:**
1. [ ] Search for your bot (e.g., `@autoleap_test_yourname_bot`)
2. [ ] Click "START"
3. [ ] Send message: `Hello`

**Expected Result in Terminal:**
- [ ] Webhook received: `POST /api/webhooks/telegram`
- [ ] Request logged with message text
- [ ] Status: 200 OK

**Advanced Test - Check Database:**
```sql
SELECT * FROM public.request_queue 
WHERE business_id = (SELECT id FROM businesses WHERE name = 'Test Business')
ORDER BY created_at DESC 
LIMIT 5;
```
- [ ] Message appears in queue
- [ ] Status: `pending` or `processed`

### 2.5 Test Bot Response (with FAQs)
**Add Test FAQ First:**
1. [ ] Go to FAQs page
2. [ ] Click "Add FAQ"
3. [ ] Question: `What are your hours?`
4. [ ] Answer: `We're open 9 AM to 5 PM, Monday to Friday.`
5. [ ] Save

**In Telegram:**
1. [ ] Send: `What are your hours?`
2. [ ] Wait 2-3 seconds

**Expected Result:**
- [ ] Bot responds with FAQ answer
- [ ] Response is accurate
- [ ] No errors in terminal

**If bot doesn't respond:**
- [ ] Check `request_queue` table for errors
- [ ] Check terminal for processing logs
- [ ] Verify `GOOGLE_API_KEY` is set

---

## Section 3: Facebook Messenger Testing

### 3.1 Setup Facebook App (One-Time)
**Prerequisites:**
- [ ] You have a Facebook account
- [ ] You have admin access to a Facebook Page

**Create Facebook App:**
1. [ ] Go to [developers.facebook.com](https://developers.facebook.com)
2. [ ] Click "My Apps" → "Create App"
3. [ ] Choose "Business" type
4. [ ] App name: `AutoLeap Test`
5. [ ] Contact email: your email
6. [ ] Create app
7. [ ] Add "Messenger" product
8. [ ] Copy **App ID** and **App Secret**

**Update `.env.local`:**
```bash
NEXT_PUBLIC_FACEBOOK_APP_ID="your_app_id_here"
FB_APP_SECRET="your_app_secret_here"
FB_VERIFY_TOKEN="my-secure-verify-token-123"
```

**Restart dev server**

### 3.2 Configure Webhooks in Facebook
**In Facebook App Dashboard:**
1. [ ] Go to Messenger → Settings
2. [ ] Under "Webhooks", click "Add Callback URL"
3. [ ] Enter:
   - Callback URL: `https://your-ngrok-url.ngrok-free.app/api/webhooks/messenger`
   - Verify Token: `my-secure-verify-token-123` (same as .env)
4. [ ] Click "Verify and Save"
5. [ ] Subscribe to fields:
   - [ ] `messages`
   - [ ] `messaging_postbacks`

**Expected Result:**
- [ ] Verification succeeds
- [ ] Green checkmark appears
- [ ] Webhook is "Active"

**Check Terminal:**
- [ ] Shows: `GET /api/webhooks/messenger?hub.verify_token=...`
- [ ] Response: 200 OK with challenge

### 3.3 Connect Facebook Page via UI
**In Browser:**
1. [ ] Go to Settings
2. [ ] Find "Facebook Messenger" section
3. [ ] Shows "Not Connected"
4. [ ] Click "Connect Facebook Page"
5. [ ] Facebook popup appears
6. [ ] Login to Facebook
7. [ ] Select your test page
8. [ ] Click "Continue"
9. [ ] Approve permissions

**Expected Result:**
- [ ] Popup closes
- [ ] Status changes to "Connected ✓"
- [ ] Page name displays
- [ ] "Disconnect" button appears

**Verify in Database:**
```sql
SELECT fb_page_id, fb_page_name, fb_page_access_token 
FROM public.businesses 
WHERE name = 'Test Business';
```
- [ ] All fields populated
- [ ] `fb_page_access_token` is NOT null

### 3.4 Test Facebook Webhook
**In Facebook:**
1. [ ] Go to your Facebook Page
2. [ ] Click "Send Message" (as if you're a customer)
3. [ ] Send: `Hello`

**Expected Result in Terminal:**
- [ ] Webhook received: `POST /api/webhooks/messenger`
- [ ] Request logged
- [ ] Shows sender_id and message text
- [ ] Status: 200 OK

### 3.5 Test Facebook Auto-Response
**Add More FAQs:**
1. [ ] Question: `What's your phone number?`
2. [ ] Answer: `You can call us at (555) 123-4567.`

**In Facebook Messenger:**
1. [ ] Send: `What's your phone number?`
2. [ ] Wait 2-3 seconds

**Expected Result:**
- [ ] Page responds automatically
- [ ] Response matches FAQ answer
- [ ] No errors

---

## Section 4: End-to-End Testing

### 4.1 Multi-Platform Test
**Setup:**
- [ ] Telegram bot connected
- [ ] Facebook page connected  
- [ ] At least 5 FAQs added

**Test Sequence:**
1. **Telegram:**
   - [ ] Send: `Do you offer refunds?`
   - [ ] Bot responds correctly
2. **Facebook:**
   - [ ] Send: `Do you offer refunds?`
   - [ ] Page responds correctly
3. **Dashboard:**
   - [ ] Go to Conversations page
   - [ ] See both Telegram and Facebook messages
   - [ ] Statistics show correct counts

### 4.2 Edge Cases
**Test Invalid Token (Telegram):**
1. [ ] Disconnect current bot
2. [ ] Try to connect with token: `123:invalid`
3. [ ] Should show error: "Invalid token format"

**Test No Permissions (Facebook):**
1. [ ] Try to connect but decline all permissions
2. [ ] Should show error

**Test Disconnect:**
1. [ ] Click "Disconnect" on Telegram
2. [ ] Confirm
3. [ ] Status changes to "Not Connected"
4. [ ] Database field cleared

---

## Section 5: Admin Dashboard Testing

### 5.1 Login as Admin
**Update admin password if needed:**
```sql
UPDATE public.users
SET password_hash = '$2b$10$9K/yNkeDNH2Jls8iuYmM6uZuUoW8H/XNPoAlwiGeRDg43a9ydtfwy'
WHERE email = 'admin@autoleap.com';
```

**Login:**
1. [ ] Go to `/auth/login`
2. [ ] Email: `admin@autoleap.com`
3. [ ] Password: `AdminPass123!`
4. [ ] Click "Sign In"

**Expected Result:**
- [ ] Redirected to `/admin`
- [ ] Dashboard has different theme (likely red/admin theme)

### 5.2 View All Businesses
1. [ ] Click "Businesses" in sidebar
2. [ ] See list of all businesses
3. [ ] Test business shows:
   - [ ] Business name
   - [ ] Telegram: ✓ Connected (if connected)
   - [ ] Facebook: ✓ Connected (if connected)
   - [ ] FAQ count

---

## Section 6: Performance & Security

### 6.1 API Response Times
**Test each endpoint:**
- [ ] `/api/telegram/connect` - Should respond < 3 seconds
- [ ] `/api/facebook/connect` - Should respond < 3 seconds
- [ ] `/api/webhooks/telegram` - Should respond < 1 second
- [ ] `/api/webhooks/messenger` - Should respond < 1 second

### 6.2 Security Checks
- [ ] Bot tokens are NOT visible in browser console
- [ ] API keys are NOT in client-side code
- [ ] `/api/admin/*` routes require admin authentication
- [ ] Can't access other business's data

---

## Common Issues & Solutions

### Issue: "Cannot connect to database"
**Solution:**
```bash
# Check Supabase connection
# Verify DATABASE_URL in .env.local
# Check Supabase dashboard for service status
```

### Issue: "Telegram webhook fails"
**Solutions:**
1. Check ngrok is running
2. Verify `NEXT_PUBLIC_BASE_URL` is correct
3. Restart dev server after updating .env
4. Check terminal logs for error details

### Issue: "Facebook SDK not loaded"
**Solution:**
1. Refresh browser
2. Check browser console for errors
3. Verify `NEXT_PUBLIC_FACEBOOK_APP_ID` is set
4. Try incognito mode

### Issue: "Bot doesn't respond"
**Debug Steps:**
1. Check `request_queue` table
2. Verify FAQs exist
3. Check `GOOGLE_API_KEY` is valid
4. Look at terminal logs for AI processing

---

## Final Checklist

### All Systems Working:
- [ ] User signup works
- [ ] User login works
- [ ] Telegram connection works
- [ ] Telegram webhook receives messages
- [ ] Telegram bot responds
- [ ] Facebook connection works
- [ ] Facebook webhook receives messages
- [ ] Facebook auto-responds
- [ ] FAQs can be added/edited
- [ ] Dashboard shows statistics
- [ ] Admin panel accessible
- [ ] All businesses visible to admin

### Documentation Ready:
- [ ] Customer onboarding guide completed
- [ ] Testing guide completed
- [ ] Environment variables documented
- [ ] Common issues documented

---

## Test Results Summary

**Date Tested:** _____________

**Tester:** _____________

**Overall Status:** ⬜ PASS / ⬜ FAIL

**Notes:**
```
[Write any issues or observations here]
```

---

**Next Steps After Testing:**
1. Deploy to production (if all tests pass)
2. Update customer documentation with production URLs
3. Create video tutorials
4. Set up monitoring/alerting
5. Plan customer onboarding emails

---

*Testing Guide Version: 1.0*
*Last Updated: January 25, 2026*
