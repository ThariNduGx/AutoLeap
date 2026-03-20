import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/infrastructure/supabase";
import * as bcrypt from "bcryptjs";
import { createSessionToken, createSessionCookie } from "@/lib/auth/session";
import { rateLimit } from "@/lib/infrastructure/rate-limit";

interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'business';
  business_id?: string | null;
  created_at: string;
  updated_at: string;
}

export async function POST(request: NextRequest) {
  // Strict rate limit for login: 10 attempts per minute per IP
  const rl = await rateLimit(request, 'auth/login', { limit: 10, windowSeconds: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetAt - Math.floor(Date.now() / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Get Supabase client
    const supabase = getSupabaseClient();

    // Find user by email
    const { data: user, error: queryError } = (await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single()) as { data: User | null; error: any };

    if (queryError || !user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check business suspension (only for business users with a linked business)
    if (user.role === 'business' && user.business_id) {
      const { data: business } = await (supabase
        .from('businesses') as any)
        .select('is_active')
        .eq('id', user.business_id)
        .single();

      if (business && business.is_active === false) {
        return NextResponse.json(
          { error: 'Your account has been suspended. Please contact support.' },
          { status: 403 }
        );
      }
    }

    // Create JWT session token
    const sessionToken = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      businessId: user.business_id,
    });

    // Create response with HTTP-only cookie
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.business_id,
        },
      },
      { status: 200 }
    );

    // Set HTTP-only cookie for session
    response.headers.set('Set-Cookie', createSessionCookie(sessionToken));

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}
