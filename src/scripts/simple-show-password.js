// Simple script to show database password from .env.local
// Run with: node src/scripts/simple-show-password.js

const fs = require("fs");
const path = require("path");

console.log("\n🔑 Reading database credentials from .env.local...\n");

try {
  const envPath = path.join(__dirname, "../../.env.local");
  const envContent = fs.readFileSync(envPath, "utf8");

  const lines = envContent.split("\n");

  console.log("=== SUPABASE DATABASE CREDENTIALS ===\n");

  for (const line of lines) {
    if (line.trim() && !line.startsWith("#")) {
      // Show database-related credentials
      if (
        line.includes("SUPABASE_DB") ||
        line.includes("DATABASE") ||
        line.includes("DB_PASSWORD")
      ) {
        console.log(line);
      }

      // Also show general Supabase credentials
      if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
        console.log(line);
      }
      if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
        const parts = line.split("=");
        console.log(`${parts[0]}=${parts[1].substring(0, 20)}...`);
      }
    }
  }

  console.log("\n======================================\n");
  console.log("✅ Credentials displayed successfully!\n");
} catch (error) {
  console.error("\n❌ Error reading .env.local:", error.message);
  console.log("\nMake sure .env.local exists in the project root.\n");
}
