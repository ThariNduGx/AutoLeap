import { createClient } from "@supabase/supabase-js";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error(
    "Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Test users to seed
const testUsers = [
  {
    email: "admin@autoleap.com",
    password: "admin123",
    name: "Admin User",
  },
  {
    email: "test@autoleap.com",
    password: "test123",
    name: "Test User",
  },
  {
    email: "demo@autoleap.com",
    password: "demo123",
    name: "Demo User",
  },
];

async function setupDatabaseAndSeed() {
  console.log("🚀 Setting up database and seeding users...\n");

  // Step 1: Check if users table exists and create if needed
  console.log("📋 Step 1: Checking users table...\n");

  try {
    const { data, error } = await supabase.from("users").select("id").limit(1);

    if (error) {
      console.log("⚠️  Users table might not exist or has different schema.");
      console.log(
        "📝 Please run the following SQL in your Supabase SQL Editor:\n"
      );
      console.log("─".repeat(70));
      console.log(`
-- Drop the old users table if it exists
DROP TABLE IF EXISTS users;

-- Create users table with authentication fields
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
      `);
      console.log("─".repeat(70));
      console.log("\nℹ️  After running the SQL, run this script again.\n");
      process.exit(1);
    }

    console.log("✅ Users table exists!\n");
  } catch (err: any) {
    console.error("❌ Error checking table:", err.message);
    process.exit(1);
  }

  // Step 2: Seed users
  console.log("📋 Step 2: Seeding users...\n");

  for (const user of testUsers) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("email")
        .eq("email", user.email)
        .single();

      if (existingUser) {
        console.log(`⏭️  User ${user.email} already exists, skipping...`);
        continue;
      }

      // Hash the password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(user.password, saltRounds);

      // Insert user
      const { data, error } = await supabase
        .from("users")
        .insert([
          {
            email: user.email,
            password_hash: passwordHash,
            name: user.name,
          },
        ])
        .select();

      if (error) {
        console.error(`❌ Error creating user ${user.email}:`, error.message);
      } else {
        console.log(`✅ Created user: ${user.email}`);
        console.log(`   Password: ${user.password}`);
        console.log(`   Name: ${user.name}\n`);
      }
    } catch (error: any) {
      console.error(
        `❌ Exception for user ${user.email}:`,
        error.message || error
      );
    }
  }

  console.log("\n🎉 Setup complete!");
  console.log("\n📝 Test Credentials:");
  console.log("═".repeat(60));
  testUsers.forEach((user) => {
    console.log(`  Email:    ${user.email}`);
    console.log(`  Password: ${user.password}`);
    console.log("─".repeat(60));
  });
  console.log("\n✅ You can now login at: http://localhost:3000/auth/login\n");
}

setupDatabaseAndSeed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
