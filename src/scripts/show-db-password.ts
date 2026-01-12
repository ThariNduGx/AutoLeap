import { getDatabaseCredentials } from "../lib/database/getAuthUsers";

/**
 * Simple script to display database connection credentials
 * Run with: node --import tsx/esm src/scripts/show-db-password.ts
 */
console.log("\n🔑 Retrieving Database Connection Information...\n");

try {
  const credentials = getDatabaseCredentials();

  if (!credentials.password) {
    console.log(
      "\n⚠️  WARNING: SUPABASE_DB_PASSWORD is not set in environment variables!"
    );
    console.log("Please add it to your .env.local file\n");
  } else {
    console.log("\n✅ Database credentials retrieved successfully!\n");
  }
} catch (error: any) {
  console.error("\n❌ Error:", error.message);
}
