/**
 * Environment Variable Validation
 *
 * Call validateEnv() at startup to fail fast if required variables are missing.
 * Groups vars by feature so the error message tells you exactly what to set.
 */

interface EnvGroup {
  name: string;
  required: boolean; // false = warn only
  vars: string[];
}

const ENV_GROUPS: EnvGroup[] = [
  {
    name: 'Core',
    required: true,
    vars: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'JWT_SECRET',
      'NEXT_PUBLIC_BASE_URL',
      'CRON_SECRET',
    ],
  },
  {
    name: 'AI (Google Gemini)',
    required: true,
    vars: ['GOOGLE_API_KEY'],
  },
  {
    name: 'Caching (Upstash Redis)',
    required: false,
    vars: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  },
  {
    name: 'Email (Resend)',
    required: false,
    vars: ['RESEND_API_KEY'],
  },
  {
    name: 'Google Calendar OAuth',
    required: false,
    vars: [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
    ],
  },
  {
    name: 'Facebook Messenger',
    required: false,
    vars: [
      'FB_APP_ID',
      'FB_APP_SECRET',
      'FB_VERIFY_TOKEN',
    ],
  },
];

export function validateEnv(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const group of ENV_GROUPS) {
    const missing = group.vars.filter(v => !process.env[v]);
    if (missing.length === 0) continue;

    const msg = `[${group.name}] Missing: ${missing.join(', ')}`;
    if (group.required) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  if (warnings.length > 0) {
    console.warn('[ENV] ⚠️  Optional environment variables not set (some features disabled):');
    warnings.forEach(w => console.warn(`  ${w}`));
  }

  if (errors.length > 0) {
    const message =
      '[ENV] ❌ Required environment variables are missing:\n' +
      errors.map(e => `  ${e}`).join('\n') +
      '\n\nServer cannot start without these variables. Check your .env.local file.';
    throw new Error(message);
  }

  console.log('[ENV] ✅ Environment validation passed');
}
