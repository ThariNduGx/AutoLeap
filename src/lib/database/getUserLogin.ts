import { supabaseAdmin } from "./supabase";
import crypto from "crypto";

/**
 * Interface for user login credentials
 */
export interface UserLoginCredentials {
  id: string;
  email: string;
  password?: string; // decrypted password
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Decrypt password using AES-256-CBC
 * Assumes passwords are encrypted in the database
 */
function decryptPassword(encryptedPassword: string): string {
  try {
    const encryptionKey = process.env.PASSWORD_ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new Error(
        "PASSWORD_ENCRYPTION_KEY is not set in environment variables"
      );
    }

    // Parse the encrypted data (format: iv:encryptedData)
    const parts = encryptedPassword.split(":");
    if (parts.length !== 2) {
      throw new Error("Invalid encrypted password format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = Buffer.from(parts[1], "hex");

    // Create decipher
    const key = crypto.scryptSync(encryptionKey, "salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    // Decrypt
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  } catch (error) {
    console.error("Error decrypting password:", error);
    throw new Error("Failed to decrypt password");
  }
}

/**
 * Retrieve user login information by email with decrypted password
 */
export async function getUserLoginByEmail(
  email: string
): Promise<UserLoginCredentials | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error) {
      console.error("Error fetching user by email:", error);
      throw error;
    }

    if (!data) {
      return null;
    }

    // If password field exists and is encrypted, decrypt it
    const userCredentials: UserLoginCredentials = {
      id: data.id,
      email: data.email,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    // Only attempt to decrypt if password field exists
    if (data.password) {
      userCredentials.password = decryptPassword(data.password);
    }

    return userCredentials;
  } catch (error) {
    console.error("Error in getUserLoginByEmail:", error);
    throw error;
  }
}

/**
 * Retrieve user login information by user ID with decrypted password
 */
export async function getUserLoginById(
  userId: string
): Promise<UserLoginCredentials | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching user by ID:", error);
      throw error;
    }

    if (!data) {
      return null;
    }

    // If password field exists and is encrypted, decrypt it
    const userCredentials: UserLoginCredentials = {
      id: data.id,
      email: data.email,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    // Only attempt to decrypt if password field exists
    if (data.password) {
      userCredentials.password = decryptPassword(data.password);
    }

    return userCredentials;
  } catch (error) {
    console.error("Error in getUserLoginById:", error);
    throw error;
  }
}

/**
 * Retrieve all users with decrypted passwords
 * WARNING: Use with caution - this returns all user credentials
 */
export async function getAllUsersWithCredentials(): Promise<
  UserLoginCredentials[]
> {
  try {
    const { data, error } = await supabaseAdmin.from("users").select("*");

    if (error) {
      console.error("Error fetching all users:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Map and decrypt passwords for all users
    const usersWithCredentials = data.map((user) => {
      const userCredentials: UserLoginCredentials = {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };

      // Only attempt to decrypt if password field exists
      if (user.password) {
        try {
          userCredentials.password = decryptPassword(user.password);
        } catch (error) {
          console.error(`Failed to decrypt password for user ${user.id}`);
        }
      }

      return userCredentials;
    });

    return usersWithCredentials;
  } catch (error) {
    console.error("Error in getAllUsersWithCredentials:", error);
    throw error;
  }
}

/**
 * Verify user credentials (for login authentication)
 */
export async function verifyUserCredentials(
  email: string,
  plainPassword: string
): Promise<boolean> {
  try {
    const user = await getUserLoginByEmail(email);

    if (!user || !user.password) {
      return false;
    }

    // Compare the plain password with the decrypted password
    return user.password === plainPassword;
  } catch (error) {
    console.error("Error verifying credentials:", error);
    return false;
  }
}
