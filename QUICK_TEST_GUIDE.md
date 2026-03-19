# 🎯 Quick Start Testing Guide

## ⚡ For You (Developer/Owner)

This is a streamlined guide to quickly test your AutoLeap application.

---

## 🚀 Quick Test (15 Minutes)

### Step 1: Start the Application (2 min)

Open TWO terminals:

**Terminal 1 - Run the app:**
```bash
cd "d:\New Files\Personal\Web Projects\AutoLeap"
npm run dev
```
Wait for: `Ready in XXXms`

**Terminal 2 - Run ngrok (for webhooks):**
```bash
ngrok http 3000
```
Copy the URL shown (e.g., `https://xxxx.ngrok-free.app`)

### Step 2: Update Environment (1 min)

1. Open `.env.local`
2. Add this line (or update if exists):
```bash
NEXT_PUBLIC_BASE_URL="https://your-ngrok-url-here.ngrok-free.app"
```
3. Save file
4. **Restart Terminal 1** (Ctrl+C, then `npm run dev` again)

### Step 3: Check Missing Environment Variables

Your `.env.local` currently MISSING:
- ❌ `NEXT_PUBLIC_BASE_URL` - Add ngrok URL
- ❌ `NEXT_PUBLIC_FACEBOOK_APP_ID` - Add if testing Facebook
- ❌ `FB_APP_SECRET` - Add if testing Facebook  
- ❌ `FB_VERIFY_TOKEN` - Add if testing Facebook
- ❌ `JWT_SECRET` - Add for authentication

**Add these now:**
```bash
# Add to .env.local
JWT_SECRET="your-super-secret-key-at-least-32-characters-long-12345"

# For Facebook (optional for now)
NEXT_PUBLIC_FACEBOOK_APP_ID="TBD"
FB_APP_SECRET="TBD"
FB_VERIFY_TOKEN="my-random-verify-token-12345"
```

---

## 🧪 Option A: Test Telegram Only (Faster)

### 1. Create Business Account (2 min)
1. Go to: `http://localhost:3000/auth/signup`
2. Enter:
   - Email: `test@mybusiness.com`
   - Password: `Test123!`
   - Business: `Test Business`
3. Sign up → Login

### 2. Create Telegram Bot (3 min)
1. Open Telegram app
2. Search: `@BotFather`
3. Send: `/newbot`
4. Name: `My Test Bot`
5. Username: `mytestbot_[random]_bot`
6. **COPY THE TOKEN**

### 3. Connect Bot (1 min)
1. In browser: Settings page
2. Find "Telegram Bot"
3. Click "Get Started"
4. Paste token
5. Click "Connect Bot"
6. ✅ Should show "Connected"

### 4. Add FAQs (2 min)
1. Go to "FAQs" page
2. Add FAQ:
   - Q: `What are your hours?`
   - A: `We're open 9 AM to 5 PM Monday-Friday.`
3. Add another:
   - Q: `How can I contact you?`
   - A: `Email us at contact@mybusiness.com`

### 5. Test Bot (1 min)
1. Open Telegram
2. Search your bot
3. Click START
4. Send: `What are your hours?`
5. **Bot should respond!**

✅ **TELEGRAM WORKS!**

---

## 🧪 Option B: Test Facebook (Requires Setup)

⚠️ **Note:** Facebook requires more setup. Only do this if you have:
- A Facebook Business Page
- Time to create a Facebook App

### Prerequisites:
1. Create Facebook App at [developers.facebook.com](https://developers.facebook.com)
2. Add "Messenger" product
3. Get App ID and App Secret
4. Update `.env.local` with Facebook credentials

### Quick Test:
1. Settings → "Facebook Messenger"
2. Click "Connect Facebook Page"
3. Login to Facebook
4. Select your page
5. ✅ Should show "Connected"

---

## 🔍 What to Check in Terminal

After sending a message to Telegram bot, you should see:

```
POST /api/webhooks/telegram 200 in XXXms
✓ Webhook received
✓ Message: "What are your hours?"
✓ Processing...
✓ Response sent
```

If you see errors:
- Check `.env.local` has all variables
- Check `GOOGLE_API_KEY` is valid
- Check ngrok URL is correct

---

## 🎯 Success Criteria

### Minimum Working Setup:
- ✅ App runs on localhost:3000
- ✅ Can create account and login
- ✅ Telegram bot connects
- ✅ Telegram webhook receives messages
- ✅ Bot sends responses
- ✅ Dashboard shows statistics

### Full Working Setup:
- ✅ Everything above, PLUS:
- ✅ Facebook page connects
- ✅ Facebook webhook receives messages
- ✅ Page auto-responds
- ✅ Both platforms work simultaneously

---

## 🐛 Common Issues

### "Cannot connect to database"
```bash
# Check Supabase status
# Verify SUPABASE credentials in .env.local
```

### "Telegram webhook not working"
**Checklist:**
1. Is ngrok running?
2. Is `NEXT_PUBLIC_BASE_URL` updated with ngrok URL?
3. Did you restart `npm run dev` after updating .env?
4. Is bot token correct?

### "Bot doesn't respond"
**Checklist:**
1. Did you add FAQs?
2. Is `GOOGLE_API_KEY` set in .env.local?
3. Check terminal for error messages
4. Check database `request_queue` table

---

## 📊 Database Quick Checks

Open Supabase → SQL Editor, run:

**Check if user was created:**
```sql
SELECT * FROM users WHERE email = 'test@mybusiness.com';
```

**Check if business was created:**
```sql
SELECT * FROM businesses WHERE name = 'Test Business';
```

**Check if bot is connected:**
```sql
SELECT telegram_bot_token, telegram_bot_username 
FROM businesses 
WHERE name = 'Test Business';
```

**Check if messages are being received:**
```sql
SELECT * FROM request_queue 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 🎬 Demo Flow (For Showing Customers)

1. **Show signup** - "Anyone can create an account"
2. **Show Telegram connect** - "Just paste your bot token"
3. **Show FAQs** - "Add your business info here"
4. **Send test message** - "Watch it respond automatically"
5. **Show dashboard** - "Track all conversations here"

**Talking Points:**
- ✨ "No technical knowledge needed"
- ✨ "Works 24/7 automatically"
- ✨ "Supports multiple platforms"
- ✨ "AI learns from your FAQs"

---

## ✅ Pre-Launch Checklist

Before giving to customers:

- [ ] Test full signup flow
- [ ] Test Telegram connection works
- [ ] Test Facebook connection works (if offering)
- [ ] Test bot responses are accurate
- [ ] Test disconnect/reconnect works
- [ ] Test with multiple FAQs
- [ ] Check dashboard shows correct stats
- [ ] Test on mobile browser (responsive)
- [ ] Create video tutorial
- [ ] Write customer onboarding email
- [ ] Set up support email/chat

---

## 📞 If Something Breaks

**Step 1:** Check terminal logs for errors

**Step 2:** Check browser console (F12 → Console tab)

**Step 3:** Check database:
```sql
-- Are the tables created?
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

**Step 4:** Review the detailed guides:
- `TESTING_GUIDE.md` - Full testing instructions
- `INTEGRATION_GUIDE.md` - How integrations work
- `MANUAL_TESTING_CHECKLIST.md` - Detailed checklist

---

## 🚀 Next Steps After Testing

1. **If tests pass:**
   - Deploy to production (Vercel/your host)
   - Update customer docs with production URL
   - Create onboarding videos
   - Launch beta with 5-10 test customers

2. **If tests fail:**
   - Review error messages
   - Check all environment variables
   - Verify database migrations ran
   - Contact me for help (if you need)

---

**Good luck! You've got this! 🎉**

---

*Quick Start Guide Version: 1.0*
*Created: January 25, 2026*
