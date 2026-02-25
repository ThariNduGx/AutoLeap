#!/usr/bin/env node

/**
 * AutoLeap Environment Checker
 * Validates that all required environment variables are present
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

const log = {
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
    title: (msg) => console.log(`${colors.blue}\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}`),
};

// Required environment variables
const requiredVars = {
    critical: [
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'DATABASE_URL',
        'JWT_SECRET',
        'GOOGLE_API_KEY',
    ],
    telegram: [
        'TELEGRAM_BOT_TOKEN', // This is webhook secret, not bot token
        'NEXT_PUBLIC_BASE_URL',
    ],
    facebook: [
        'NEXT_PUBLIC_FACEBOOK_APP_ID',
        'FB_APP_SECRET',
        'FB_VERIFY_TOKEN',
    ],
    optional: [
        'OPENAI_API_KEY',
        'USE_OPENROUTER',
        'KV_REST_API_URL',
        'KV_REST_API_TOKEN',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
    ],
};

function loadEnvFile() {
    const envPath = path.join(__dirname, '.env.local');

    if (!fs.existsSync(envPath)) {
        log.error('.env.local file not found!');
        log.info('Create .env.local file in the project root');
        process.exit(1);
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
        const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?$/);
        if (match) {
            envVars[match[1]] = match[2];
        }
    });

    return envVars;
}

function checkEnvironment() {
    log.title('🔍 AutoLeap Environment Checker');

    const env = loadEnvFile();
    let hasErrors = false;
    let hasWarnings = false;

    // Check Critical Variables
    console.log('\n📌 Critical Variables (Required):');
    requiredVars.critical.forEach(varName => {
        if (env[varName] && env[varName].trim() !== '') {
            log.success(`${varName}`);
        } else {
            log.error(`${varName} - MISSING or EMPTY`);
            hasErrors = true;
        }
    });

    // Check Telegram Variables
    console.log('\n📱 Telegram Variables (Required for Telegram):');
    requiredVars.telegram.forEach(varName => {
        if (env[varName] && env[varName].trim() !== '') {
            log.success(`${varName}`);
        } else {
            log.warning(`${varName} - MISSING (Telegram won't work)`);
            hasWarnings = true;
        }
    });

    // Check Facebook Variables
    console.log('\n💙 Facebook Variables (Required for Facebook):');
    requiredVars.facebook.forEach(varName => {
        if (env[varName] && env[varName].trim() !== '') {
            log.success(`${varName}`);
        } else {
            log.warning(`${varName} - MISSING (Facebook won't work)`);
            hasWarnings = true;
        }
    });

    // Check Optional Variables
    console.log('\n🔧 Optional Variables:');
    requiredVars.optional.forEach(varName => {
        if (env[varName] && env[varName].trim() !== '') {
            log.success(`${varName}`);
        } else {
            log.info(`${varName} - Not set (OK)`);
        }
    });

    // Specific Validations
    console.log('\n🔐 Validation Checks:');

    // JWT Secret length
    if (env.JWT_SECRET) {
        if (env.JWT_SECRET.length >= 32) {
            log.success('JWT_SECRET has sufficient length');
        } else {
            log.error('JWT_SECRET should be at least 32 characters');
            hasErrors = true;
        }
    }

    // Database URL format
    if (env.DATABASE_URL) {
        if (env.DATABASE_URL.includes('postgres://') || env.DATABASE_URL.includes('postgresql://')) {
            log.success('DATABASE_URL format looks correct');
        } else {
            log.error('DATABASE_URL format looks incorrect');
            hasErrors = true;
        }
    }

    // Supabase URL format
    if (env.NEXT_PUBLIC_SUPABASE_URL) {
        if (env.NEXT_PUBLIC_SUPABASE_URL.includes('supabase.co')) {
            log.success('NEXT_PUBLIC_SUPABASE_URL format looks correct');
        } else {
            log.warning('NEXT_PUBLIC_SUPABASE_URL format might be incorrect');
            hasWarnings = true;
        }
    }

    // Base URL format (for webhooks)
    if (env.NEXT_PUBLIC_BASE_URL) {
        if (env.NEXT_PUBLIC_BASE_URL.startsWith('https://')) {
            log.success('NEXT_PUBLIC_BASE_URL uses HTTPS (required for webhooks)');
        } else if (env.NEXT_PUBLIC_BASE_URL.startsWith('http://localhost')) {
            log.warning('NEXT_PUBLIC_BASE_URL is localhost (webhooks won\'t work)');
            log.info('Use ngrok for local testing: ngrok http 3000');
            hasWarnings = true;
        } else {
            log.error('NEXT_PUBLIC_BASE_URL should start with https://');
            hasErrors = true;
        }
    }

    // Summary
    log.title('📊 Summary');

    if (hasErrors) {
        log.error('Critical errors found! Fix them before running the app.');
        console.log('\nTo fix:');
        console.log('1. Open .env.local');
        console.log('2. Add the missing variables');
        console.log('3. Run this checker again: node check-env.js\n');
        process.exit(1);
    } else if (hasWarnings) {
        log.warning('Configuration has warnings.');
        console.log('\nYour app will run, but some features may not work:');
        console.log('- Telegram requires: TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_BASE_URL');
        console.log('- Facebook requires: NEXT_PUBLIC_FACEBOOK_APP_ID, FB_APP_SECRET, FB_VERIFY_TOKEN');
        console.log('\nContinue with: npm run dev\n');
    } else {
        log.success('All critical variables are set!');
        console.log('\nYou\'re ready to run: npm run dev\n');
    }
}

// Run the checker
try {
    checkEnvironment();
} catch (error) {
    log.error(`Unexpected error: ${error.message}`);
    process.exit(1);
}
