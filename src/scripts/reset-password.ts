/**
 * Password Reset Script
 * Run with: npx ts-node src/scripts/reset-password.ts
 */

import * as bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

// Get credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://glzlorvhnfpiebnfwvdl.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetPassword() {
    // Get email from command line argument or use default
    const email = process.argv[2];
    const newPassword = process.argv[3];

    if (!email || !newPassword) {
        console.log("\n📧 Password Reset Tool");
        console.log("========================");
        console.log("\nUsage: npx ts-node src/scripts/reset-password.ts <email> <new-password>");
        console.log("\nExample: npx ts-node src/scripts/reset-password.ts admin@example.com MyNewPassword123");

        // List existing users
        console.log("\n📋 Existing users in database:");
        const { data: users, error } = await supabase
            .from("users")
            .select("id, email, name, role")
            .limit(10);

        if (error) {
            console.error("Error fetching users:", error.message);
            return;
        }

        if (users && users.length > 0) {
            users.forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.email} (${user.role}) - ${user.name || 'No name'}`);
            });
        } else {
            console.log("  No users found in database.");
        }
        return;
    }

    console.log(`\n🔐 Resetting password for: ${email}`);

    // Hash the new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update the user's password
    const { data, error } = await supabase
        .from("users")
        .update({ password_hash: passwordHash })
        .eq("email", email)
        .select();

    if (error) {
        console.error("❌ Error updating password:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.error(`❌ No user found with email: ${email}`);
        return;
    }

    console.log(`✅ Password updated successfully for ${email}`);
    console.log(`\n🔑 New password: ${newPassword}`);
    console.log("\nYou can now log in with the new password.");
}

resetPassword().catch(console.error);
