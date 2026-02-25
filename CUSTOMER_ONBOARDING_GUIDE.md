# 🚀 AutoLeap - Customer Onboarding Guide

**Welcome to AutoLeap!** This guide will help you connect your business's Telegram Bot and Facebook Page to start automating customer conversations with AI.

---

## 📋 Table of Contents

1. [What is AutoLeap?](#what-is-autoleap)
2. [Getting Started](#getting-started)
3. [Connect Telegram Bot](#connect-telegram-bot)
4. [Connect Facebook Messenger](#connect-facebook-messenger)
5. [Add Your FAQs](#add-your-faqs)
6. [Test Your Setup](#test-your-setup)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 What is AutoLeap?

AutoLeap is an AI-powered customer service platform that automatically responds to customer messages on:
- ✅ **Telegram** (via your business bot)
- ✅ **Facebook Messenger** (via your business page)

Our AI learns from your FAQs and provides instant, accurate responses to customer inquiries 24/7.

---

## 🏁 Getting Started

### Step 1: Create Your Account

1. Go to the AutoLeap platform
2. Click **"Sign Up"**
3. Enter:
   - Your **Business Name**
   - Your **Email Address**
   - Create a **Strong Password**
4. Click **"Create Account"**
5. **Login** with your credentials

### Step 2: Access Your Dashboard

After logging in, you'll see your business dashboard with:
- 📊 **Statistics** - Message counts and metrics
- ⚙️ **Settings** - Where you'll connect your platforms
- 📝 **FAQs** - Add your business FAQs here
- 💬 **Conversations** - View all customer interactions

---

## 📱 Connect Telegram Bot

### What You'll Need:
- A Telegram account (download from [telegram.org](https://telegram.org))
- 5 minutes of your time

### Step-by-Step Instructions:

#### 1. Create Your Telegram Bot

1. Open **Telegram** on your phone or computer
2. Search for `@BotFather` (this is Telegram's official bot creator)
3. Click **"START"** or send `/start`
4. Send the command: `/newbot`
5. BotFather will ask you questions:

   **Question 1: "Choose a name for your bot"**
   - Example: `My Business Support Bot`
   - This is the display name customers will see

   **Question 2: "Choose a username for your bot"**
   - Must end with `bot`
   - Example: `mybusiness_support_bot`
   - This must be unique across all Telegram bots

6. **Success!** BotFather will reply with your **Bot Token**
   - It looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
   - **COPY THIS TOKEN** - you'll need it in the next step

#### 2. Connect Bot to AutoLeap

1. In your AutoLeap dashboard, click **"Settings"** in the sidebar
2. Find the **"Telegram Bot"** section
3. Click **"Get Started"**
4. **Paste your Bot Token** in the input field
5. Click **"Connect Bot"**
6. ✅ You should see **"Connected"** with a green checkmark!

#### 3. Test Your Telegram Bot

1. Open Telegram
2. Search for your bot's username (e.g., `@mybusiness_support_bot`)
3. Click **"START"**
4. Send a test message: `Hello!`
5. Your bot should respond! (Make sure you've added FAQs first)

---

## 💙 Connect Facebook Messenger

### What You'll Need:
- A Facebook Business Page (if you don't have one, [create one here](https://www.facebook.com/pages/create))
- Admin access to that page
- 3 minutes of your time

### Step-by-Step Instructions:

#### 1. Prepare Your Facebook Page

1. Make sure you have a **Facebook Business Page**
   - Not a personal profile - it must be a Page
2. Make sure you're an **Admin** of that page
3. Enable **Messenger** on your page:
   - Go to your Page Settings
   - Click **"Messaging"**
   - Turn on **"Allow people to contact my Page privately"**

#### 2. Connect Page to AutoLeap

1. In your AutoLeap dashboard, go to **"Settings"**
2. Find the **"Facebook Messenger"** section
3. Click **"Connect Facebook Page"**
4. A **Facebook login popup** will appear
5. **Login to Facebook** (if you're not already)
6. **Select the page** you want to connect
7. Click **"Continue"** to grant permissions
8. ✅ You should see **"Connected"** with your page name!

#### 3. Test Your Facebook Messenger

1. Go to your **Facebook Page**
2. Click **"Send Message"** (or have a friend send a message)
3. Send a test message: `What are your hours?`
4. Your page should auto-respond! (Make sure you've added FAQs first)

---

## 📝 Add Your FAQs

Your AI needs to learn about your business! Add FAQs so the bot knows how to respond to customers.

### How to Add FAQs:

1. In your dashboard, click **"FAQs"** in the sidebar
2. Click **"Add New FAQ"**
3. Fill in:
   - **Question**: What customers might ask
   - **Answer**: Your response
   - **Category**: (Optional) Organize by topic

### Example FAQs:

**FAQ 1: Business Hours**
- Question: `What are your business hours?`
- Answer: `We're open Monday to Friday, 9 AM to 6 PM. Closed on weekends.`
- Category: `General`

**FAQ 2: Pricing**
- Question: `How much does it cost?`
- Answer: `Our basic package starts at $50/month. For custom pricing, please contact us.`
- Category: `Pricing`

**FAQ 3: Location**
- Question: `Where are you located?`
- Answer: `We're located at 123 Main Street, City, State. You can also visit us online!`
- Category: `Location`

**FAQ 4: Contact**
- Question: `How can I contact you?`
- Answer: `You can reach us at contact@mybusiness.com or call (123) 456-7890.`
- Category: `Contact`

### Tips for Great FAQs:
- ✅ Use natural language (how customers actually ask)
- ✅ Be specific and clear in answers
- ✅ Add at least 10-15 FAQs to start
- ✅ Include common questions about:
  - Products/Services
  - Pricing
  - Hours
  - Location
  - Shipping/Delivery
  - Returns/Refunds
  - Contact information

---

## ✅ Test Your Setup

### Complete Testing Checklist:

#### Telegram Bot Test:
- [ ] Bot is connected (green checkmark in Settings)
- [ ] Send message: `What are your hours?`
- [ ] Bot responds with correct information
- [ ] Send message: `Tell me about pricing`
- [ ] Bot responds intelligently based on your FAQs

#### Facebook Messenger Test:
- [ ] Page is connected (green checkmark in Settings)
- [ ] Visit your Facebook Page
- [ ] Click "Send Message"
- [ ] Send: `Hello, I have a question`
- [ ] Page auto-responds

#### Dashboard Check:
- [ ] Login to AutoLeap dashboard
- [ ] Check **Statistics** - see message counts
- [ ] Check **Conversations** - see all messages
- [ ] Verify both platforms show "Connected"

---

## 🆘 Troubleshooting

### Telegram Issues:

#### Problem: "Invalid bot token"
**Solution:**
- Go back to @BotFather in Telegram
- Send `/token` to get your token again
- Copy the entire token (including numbers before the colon)
- Paste it carefully (no extra spaces)

#### Problem: "Bot doesn't respond to messages"
**Solutions:**
1. Make sure you've added FAQs
2. Check that bot shows "Connected" in Settings
3. Try disconnecting and reconnecting
4. Send `/start` to your bot first

#### Problem: "Webhook registration failed"
**Solution:**
- This is a backend issue - contact support
- Provide your business email

---

### Facebook Issues:

#### Problem: "Facebook SDK not loaded"
**Solution:**
- Refresh your browser page
- Clear your browser cache
- Try a different browser (Chrome recommended)

#### Problem: "Login was cancelled"
**Solution:**
- You clicked "Cancel" on Facebook popup
- Click "Connect Facebook Page" again
- Make sure to approve all permissions

#### Problem: "No pages found"
**Solutions:**
1. Make sure you have a **Business Page** (not a personal profile)
2. Make sure you're an **Admin** of that page
3. Create a page first: [facebook.com/pages/create](https://facebook.com/pages/create)

#### Problem: "Page doesn't auto-respond"
**Solutions:**
1. Make sure you've added FAQs
2. Check page shows "Connected" in Settings
3. Make sure Messenger is enabled on your page
4. Try disconnecting and reconnecting

---

### General Issues:

#### Problem: "Can't login to dashboard"
**Solution:**
- Check your email and password
- Use "Forgot Password" if needed
- Email support with your business name

#### Problem: "AI responds incorrectly"
**Solutions:**
1. Review your FAQs - make them more specific
2. Add more FAQs to give AI better context
3. Rephrase answers to be clearer

#### Problem: "Changes not showing"
**Solution:**
- Refresh your browser page
- Clear browser cache (Ctrl+Shift+Delete)
- Log out and log back in

---

## 📞 Need More Help?

### Resources:
- 📚 **Documentation**: [Your docs link]
- 💬 **Live Chat**: Available in dashboard
- 📧 **Email Support**: support@autoleap.com
- 🎥 **Video Tutorials**: [Your YouTube/tutorial link]

### Support Hours:
Monday - Friday: 9 AM - 6 PM (EST)
Response time: Within 24 hours

---

## 🎉 You're All Set!

Congratulations! You've successfully set up AutoLeap. Your business now has:
- ✅ 24/7 automated customer support
- ✅ AI-powered responses
- ✅ Multi-platform messaging (Telegram + Facebook)
- ✅ Reduced response time
- ✅ Increased customer satisfaction

### Next Steps:
1. Add more FAQs to improve AI accuracy
2. Monitor conversations in your dashboard
3. Adjust FAQ answers based on customer questions
4. Explore advanced features (coming soon!)

**Thank you for choosing AutoLeap! 🚀**

---

*Last Updated: January 2026*
*Version: 1.0*
