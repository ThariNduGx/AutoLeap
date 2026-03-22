# 🎯 AutoLeap Testing Flow - Visual Guide

## 📋 Table of Contents

1. [Complete Testing & Onboarding Flow](#complete-testing--onboarding-flow)
2. [Platform Comparison](#platform-comparison)
3. [Testing Priority Recommendation](#testing-priority-recommendation)
   - [Start with Telegram (Today)](#start-with-telegram-today)
   - [Add Facebook (Later)](#add-facebook-later)
4. [Quick Checklist](#quick-checklist)
   - [Before Testing](#before-testing)
   - [Telegram Test](#telegram-test)
   - [Facebook Test (Optional)](#facebook-test-optional)
5. [Start Testing Command](#start-testing-command)
6. [Documentation Quick Reference](#documentation-quick-reference)
7. [Success Metrics](#success-metrics)

---

## 📊 Complete Testing & Onboarding Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   AutoLeap Testing & Customer Onboarding                      │
└─────────────────────────────────────────────────────────────────────────────┘

PHASE 1: DEVELOPER SETUP (You - Today)
┌─────────────────────────────────────────────────────────────────┐
│  1. Environment Setup                                            │
│     ├─ ✅ npm run dev (running on localhost:3000)              │
│     ├─ ✅ .env.local configured with JWT_SECRET                │
│     ├─ ✅ Database connected (Supabase)                        │
│     └─ ✅ AI configured (Google Gemini)                        │
│                                                                  │
│  2. Webhook Setup (for Telegram/Facebook testing)               │
│     ├─ Start ngrok: ngrok http 3000                             │
│     ├─ Copy ngrok URL: https://xxxx.ngrok-free.app             │
│     ├─ Update .env.local: NEXT_PUBLIC_BASE_URL                 │
│     └─ Restart: npm run dev                                     │
│                                                                  │
│  3. Quick Test                                                   │
│     ├─ Go to: http://localhost:3000/auth/signup                │
│     ├─ Create test account                                      │
│     ├─ Login → Dashboard                                        │
│     └─ Verify: Settings, FAQs, Conversations load              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Test Telegram Integration                                   │
│     ┌──────────────────────────────────────────────────────┐   │
│     │  A. Create Bot                                         │   │
│     │     • Open Telegram → @BotFather                       │   │
│     │     • Send: /newbot                                    │   │
│     │     • Follow prompts                                   │   │
│     │     • Copy bot token                                   │   │
│     └──────────────────────────────────────────────────────┘   │
│                           ↓                                      │
│     ┌──────────────────────────────────────────────────────┐   │
│     │  B. Connect in Dashboard                               │   │
│     │     • Settings → Telegram Bot                          │   │
│     │     • Click "Get Started"                              │   │
│     │     • Paste token                                      │   │
│     │     • Click "Connect"                                  │   │
│     │     • ✅ Should show "Connected"                       │   │
│     └──────────────────────────────────────────────────────┘   │
│                           ↓                                      │
│     ┌──────────────────────────────────────────────────────┐   │
│     │  C. Add FAQs                                           │   │
│     │     • Go to FAQs page                                  │   │
│     │     • Add 3-5 test FAQs                                │   │
│     │     • Save                                             │   │
│     └──────────────────────────────────────────────────────┘   │
│                           ↓                                      │
│     ┌──────────────────────────────────────────────────────┐   │
│     │  D. Test Bot                                           │   │
│     │     • Open Telegram                                    │   │
│     │     • Search your bot                                  │   │
│     │     • Click START                                      │   │
│     │     • Send: "What are your hours?"                     │   │
│     │     • ✅ Bot responds automatically!                   │   │
│     └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘


PHASE 2: CUSTOMER ONBOARDING (Your Customers)
┌─────────────────────────────────────────────────────────────────┐
│  Customer Journey                                                │
│                                                                  │
│  1. Signup                                                       │
│     └─ Customer creates account at your platform                │
│                                                                  │
│  2. Dashboard                                                    │
│     └─ Sees clean interface with Settings, FAQs, etc.          │
│                                                                  │
│  3. Connect Platforms (2 options)                               │
│                                                                  │
│     ┌─────────────────────────────────────────────────────┐    │
│     │  Option A: Telegram                                  │    │
│     │  ┌────────────────────────────────────────────────┐ │    │
│     │  │ 1. Go to Settings                               │ │    │
│     │  │ 2. Find "Telegram Bot" section                  │ │    │
│     │  │ 3. Click "Get Started"                          │ │    │
│     │  │ 4. See step-by-step instructions:               │ │    │
│     │  │    • Create bot with @BotFather                 │ │    │
│     │  │    • Copy token                                 │ │    │
│     │  │    • Paste and connect                          │ │    │
│     │  │ 5. ✅ Shows "Connected"                         │ │    │
│     │  └────────────────────────────────────────────────┘ │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                  │
│     ┌─────────────────────────────────────────────────────┐    │
│     │  Option B: Facebook                                  │    │
│     │  ┌────────────────────────────────────────────────┐ │    │
│     │  │ 1. Go to Settings                               │ │    │
│     │  │ 2. Find "Facebook Messenger" section            │ │    │
│     │  │ 3. Click "Connect Facebook Page"                │ │    │
│     │  │ 4. Facebook popup appears                       │ │    │
│     │  │ 5. Login to Facebook                            │ │    │
│     │  │ 6. Select their business page                   │ │    │
│     │  │ 7. Approve permissions                          │ │    │
│     │  │ 8. ✅ Shows "Connected" with page name          │ │    │
│     │  └────────────────────────────────────────────────┘ │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                  │
│  4. Add FAQs                                                     │
│     ├─ Customer adds their business FAQs                        │
│     ├─ Questions customers might ask                            │
│     └─ Answers they want to provide                             │
│                                                                  │
│  5. Test & Go Live                                              │
│     ├─ Send test message to their bot/page                      │
│     ├─ Verify auto-response works                               │
│     └─ ✅ Start receiving customer messages!                    │
└─────────────────────────────────────────────────────────────────┘


PHASE 3: LIVE OPERATION (Automated)
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   Customer sends message                                        │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────────┐                                         │
│   │  Telegram/        │                                         │
│   │  Facebook         │                                         │
│   │  Webhook          │                                         │
│   └──────────────────┘                                         │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────────┐                                         │
│   │  AutoLeap API    │                                         │
│   │  Receives Message│                                         │
│   └──────────────────┘                                         │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────────┐                                         │
│   │  AI Processing   │                                         │
│   │  (Uses FAQs)     │                                         │
│   └──────────────────┘                                         │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────────┐                                         │
│   │  Generate Reply  │                                         │
│   └──────────────────┘                                         │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────────┐                                         │
│   │  Send to Customer│                                         │
│   └──────────────────┘                                         │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────────┐                                         │
│   │  Log in Dashboard│                                         │
│   └──────────────────┘                                         │
│                                                                  │
│   ⏱️  Total time: 2-3 seconds                                   │
│   ✅  24/7 Automated                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Platform Comparison

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Telegram vs Facebook Setup                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  TELEGRAM                          FACEBOOK                          │
│  ─────────────────────────────     ──────────────────────────────   │
│  ✅ Easier to set up                ⚠️  More complex setup          │
│  ✅ No app creation needed          ❌ Requires Facebook App        │
│  ✅ Just need bot token             ❌ Need App ID & Secret         │
│  ✅ Instant webhook setup           ⚠️  Manual webhook config       │
│  ✅ Great for testing               ✅ Better for businesses        │
│                                                                       │
│  Time to set up:                   Time to set up:                   │
│  📊 5-10 minutes                    📊 15-20 minutes                 │
│                                                                       │
│  Customer difficulty:               Customer difficulty:              │
│  🟢 Easy                             🟡 Medium                        │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Testing Priority Recommendation

### Start with Telegram (Today)
```
Priority: 🔥🔥🔥 HIGH
Time: 15 minutes
Why: Faster to test, validates entire system
```

1. Follow `QUICK_TEST_GUIDE.md` → Option A
2. You'll have a working bot in 15 minutes
3. This validates:
   - ✅ Authentication works
   - ✅ Database works
   - ✅ Webhooks work
   - ✅ AI responses work
   - ✅ Dashboard works

### Add Facebook (Later)
```
Priority: 🔥 MEDIUM
Time: 30 minutes
Why: More complex, but validates multi-platform
```

1. Only if you plan to offer Facebook
2. Follow `MANUAL_TESTING_CHECKLIST.md` → Section 3
3. Requires Facebook Developer account

---

## 📋 Quick Checklist

### Before Testing:
- [x] App running (`npm run dev`)
- [x] Environment variables set (`.env.local`)
- [x] Database connected (Supabase)
- [ ] ngrok running (for webhooks) ← **DO THIS NOW**
- [ ] Test account created

### Telegram Test:
- [ ] Created bot with @BotFather
- [ ] Got bot token
- [ ] Connected in dashboard
- [ ] Added 3+ FAQs
- [ ] Sent test message
- [ ] Bot responded

### Facebook Test (Optional):
- [ ] Created Facebook App
- [ ] Got App ID and Secret
- [ ] Updated .env.local
- [ ] Configured webhooks
- [ ] Connected page
- [ ] Sent test message
- [ ] Page responded

---

## 🚀 Start Testing Command

```bash
# Terminal 1 (already running)
# npm run dev is running ✅

# Terminal 2 (NEW - start ngrok)
ngrok http 3000

# Then:
# 1. Copy ngrok URL
# 2. Update .env.local → NEXT_PUBLIC_BASE_URL
# 3. Restart Terminal 1 (Ctrl+C, then npm run dev)
# 4. Follow QUICK_TEST_GUIDE.md
```

---

## 📚 Documentation Quick Reference

| Need | Use This File |
|------|---------------|
| Quick test (15 min) | `QUICK_TEST_GUIDE.md` |
| Comprehensive testing | `MANUAL_TESTING_CHECKLIST.md` |
| Customer guide | `CUSTOMER_ONBOARDING_GUIDE.md` |
| Environment check | `node check-env.js` |
| Technical details | `INTEGRATION_GUIDE.md` |
| Overview | `TESTING_PACKAGE_README.md` |

---

## ✨ Success Metrics

You'll know it's working when:

```
Telegram:
✅ Bot shows "Connected" in Settings
✅ Terminal shows: POST /api/webhooks/telegram 200
✅ Bot responds to messages
✅ Dashboard shows conversation count

Facebook:
✅ Page shows "Connected" in Settings
✅ Terminal shows: POST /api/webhooks/messenger 200
✅ Page auto-responds to messages
✅ Dashboard shows conversation count

Overall:
✅ No errors in terminal
✅ FAQs appear in dashboard
✅ Statistics update in real-time
✅ All responses are accurate
```

---

## 🎉 You've Got Everything!

**Created Files:**
1. ✅ CUSTOMER_ONBOARDING_GUIDE.md
2. ✅ MANUAL_TESTING_CHECKLIST.md
3. ✅ QUICK_TEST_GUIDE.md
4. ✅ TESTING_PACKAGE_README.md
5. ✅ check-env.js
6. ✅ This visual guide

**Updated Files:**
1. ✅ .env.local (added JWT_SECRET, BASE_URL, Facebook placeholders)

**Ready to Use:**
- Your app is running on localhost:3000
- Environment is configured
- Documentation is complete
- Just need to start ngrok and test!

**Next Step:**
Open `QUICK_TEST_GUIDE.md` and follow "Option A: Test Telegram Only"

---

*Visual Flow Guide Version: 1.0*
*Created: January 25, 2026*
