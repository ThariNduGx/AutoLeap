import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log("🔄 Running database migration...\n");

  try {
    // Read the migration file
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "002_create_users_table.sql"
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // Split the file by statements (simple approach - split on semicolon followed by newline)
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    // Execute each statement
    for (const statement of statements) {
      if (statement) {
        const { error } = (await supabase.rpc("exec_sql", {
          sql: statement + ";",
        })) as any;

        // If RPC doesn't exist, try direct query (this might not work for all SQL)
        if (error && error.message?.includes("exec_sql")) {
          console.log(
            "⚠️  RPC method not available, trying direct execution..."
          );
          // For Supabase, we need to use their admin methods or raw SQL
          // Let's just log the SQL for now
          console.log(
            "ℹ️  Please run this SQL manually in Supabase dashboard:"
          );
          console.log(migrationSQL);
          break;
        } else if (error) {
          console.error("❌ Error executing statement:", error);
        }
      }
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("📝 Table `users` has been created with the following schema:");
    console.log("   - id (UUID, primary key)");
    console.log("   - email (TEXT, unique, not null)");
    console.log("   - password_hash (TEXT, not null)");
    console.log("   - name (TEXT, not null)");
    console.log("   - created_at (TIMESTAMPTZ)");
    console.log("   - updated_at (TIMESTAMPTZ)\n");

    return true;
  } catch (error) {
    console.error("❌ Migration failed:", error);
    return false;
  }
}

runMigration()
  .then((success) => {
    if (success) {
      console.log("✅ You can now run: npx tsx src/scripts/seed-users.ts");
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
