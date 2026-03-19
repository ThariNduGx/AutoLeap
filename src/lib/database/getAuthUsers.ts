import { supabaseAdmin } from "./supabase";

/**
 * Interface for Supabase Auth User
 */
export interface AuthUserInfo {
  id: string;
  email: string;
  phone?: string;
  createdAt: string;
  lastSignInAt?: string;
  emailConfirmedAt?: string;
  role?: string;
  // Note: Actual encrypted password hash is NOT accessible via API for security reasons
  // Supabase Auth handles password encryption and you cannot retrieve plain passwords
}

/**
 * Retrieve user from Supabase Auth by email
 * Note: This retrieves user metadata, NOT the plain password (which is impossible and insecure)
 */
export async function getAuthUserByEmail(
  email: string
): Promise<AuthUserInfo | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error("Error fetching auth users:", error);
      throw error;
    }

    const user = data.users.find((u) => u.email === email);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || "",
      phone: user.phone,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      emailConfirmedAt: user.email_confirmed_at,
      role: user.role,
    };
  } catch (error) {
    console.error("Error in getAuthUserByEmail:", error);
    throw error;
  }
}

/**
 * Retrieve user from Supabase Auth by ID
 */
export async function getAuthUserById(
  userId: string
): Promise<AuthUserInfo | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error) {
      console.error("Error fetching auth user by ID:", error);
      throw error;
    }

    if (!data.user) {
      return null;
    }

    const user = data.user;

    return {
      id: user.id,
      email: user.email || "",
      phone: user.phone,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      emailConfirmedAt: user.email_confirmed_at,
      role: user.role,
    };
  } catch (error) {
    console.error("Error in getAuthUserById:", error);
    throw error;
  }
}

/**
 * Retrieve all Supabase Auth users
 */
export async function getAllAuthUsers(): Promise<AuthUserInfo[]> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error("Error fetching all auth users:", error);
      throw error;
    }

    return data.users.map((user) => ({
      id: user.id,
      email: user.email || "",
      phone: user.phone,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      emailConfirmedAt: user.email_confirmed_at,
      role: user.role,
    }));
  } catch (error) {
    console.error("Error in getAllAuthUsers:", error);
    throw error;
  }
}

/**
 * Get user credentials for direct database access
 * This retrieves the PostgreSQL database user credentials from environment variables
 * NOT to be confused with application user login credentials
 */
export function getDatabaseCredentials() {
  const credentials = {
    host: process.env.SUPABASE_DB_HOST,
    database: process.env.SUPABASE_DB_NAME || "postgres",
    user: process.env.SUPABASE_DB_USER || "postgres",
    password: process.env.SUPABASE_DB_PASSWORD,
    port: process.env.SUPABASE_DB_PORT || "5432",
  };

  console.log("=== DATABASE CONNECTION CREDENTIALS ===");
  console.log("Host:", credentials.host);
  console.log("Database:", credentials.database);
  console.log("User:", credentials.user);
  console.log("Password:", credentials.password);
  console.log("Port:", credentials.port);
  console.log("=======================================");

  return credentials;
}
