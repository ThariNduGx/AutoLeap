/**
 * Authentication Utilities
 * Secure session management with HTTP-only cookies
 */

import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production-minimum-32-chars'
);

const JWT_EXPIRY = '7d'; // 7 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'business';
  businessId?: string | null;
}

/**
 * Create a JWT token for a user session
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    businessId: user.businessId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    const payload = verified.payload as any;

    return {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      businessId: payload.businessId,
    };
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error);
    return null;
  }
}

/**
 * Get session from request cookies
 */
export async function getSession(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get('session')?.value;
  
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

/**
 * Check if user has required role
 */
export function hasRole(user: SessionUser | null, requiredRole: 'admin' | 'business'): boolean {
  if (!user) return false;
  
  // Admin has access to everything
  if (user.role === 'admin') return true;
  
  // Business user can only access business role
  return user.role === requiredRole;
}

/**
 * Check if user can access specific business
 */
export function canAccessBusiness(user: SessionUser | null, businessId: string): boolean {
  if (!user) return false;
  
  // Admin can access any business
  if (user.role === 'admin') return true;
  
  // Business user can only access their own business
  return user.businessId === businessId;
}

/**
 * Create session cookie string
 */
export function createSessionCookie(token: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return `session=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${
    isProduction ? '; Secure' : ''
  }`;
}

/**
 * Create logout cookie string (expires immediately)
 */
export function createLogoutCookie(): string {
  return 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict';
}
