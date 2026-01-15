import {
  getUserLoginByEmail,
  getAllUsersWithCredentials,
} from "@/lib/database/getUserLogin";

/**
 * Test script to retrieve and display user login information with decrypted passwords
 * Run with: npx tsx src/scripts/test-get-user-login.ts
 */
async function testGetUserLogin() {
  console.log("=== TESTING USER LOGIN RETRIEVAL ===\n");

  try {
    // Test 1: Get all users with credentials
    console.log("📋 Fetching all users with credentials...\n");
    const allUsers = await getAllUsersWithCredentials();

    if (allUsers.length === 0) {
      console.log("⚠️  No users found in database");
      return;
    }

    console.log(`✅ Found ${allUsers.length} user(s):\n`);

    allUsers.forEach((user, index) => {
      console.log(`--- User ${index + 1} ---`);
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Password (Decrypted): ${user.password || "N/A"}`);
      console.log(`Created At: ${user.createdAt || "N/A"}`);
      console.log(`Updated At: ${user.updatedAt || "N/A"}`);
      console.log("");
    });

    // Test 2: Get specific user if exists
    if (allUsers.length > 0) {
      const firstUserEmail = allUsers[0].email;
      console.log(`\n🔍 Testing retrieval by email: ${firstUserEmail}`);
      const userByEmail = await getUserLoginByEmail(firstUserEmail);

      if (userByEmail) {
        console.log("✅ Successfully retrieved user by email");
        console.log(`Email: ${userByEmail.email}`);
        console.log(`Password: ${userByEmail.password || "N/A"}`);
      }
    }
  } catch (error: any) {
    console.error("❌ Error during test:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Run the test
testGetUserLogin()
  .then(() => {
    console.log("\n✅ Test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
