import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import * as bcrypt from 'bcryptjs';
import { rateLimit } from '@/lib/infrastructure/rate-limit';

interface SignupRequest {
    businessName: string;
    name: string;
    email: string;
    password: string;
}

/**
 * POST /api/auth/signup
 * 
 * Create a new business user account
 * - Creates business entry
 * - Creates user account
 * - Links user to business
 */
export async function POST(request: NextRequest) {
    // 5 signups per IP per hour to prevent abuse
    const rl = await rateLimit(request, 'auth/signup', { limit: 5, windowSeconds: 3600 });
    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'Too many signup attempts. Please try again later.' },
            { status: 429, headers: { 'Retry-After': String(rl.resetAt - Math.floor(Date.now() / 1000)) } }
        );
    }

    try {
        const body: SignupRequest = await request.json();
        const { businessName, name, email, password } = body;

        // Validate input
        if (!businessName || !name || !email || !password) {
            return NextResponse.json(
                { error: 'All fields are required' },
                { status: 400 }
            );
        }

        // Validate password length
        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseClient();

        // Normalize email to lowercase so login remains case-insensitive
        const normalizedEmail = email.toLowerCase().trim();

        // Check if email already exists
        const { data: existingUser } = await (supabase
            .from('users') as any)
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (existingUser) {
            return NextResponse.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Step 1: Create business
        const { data: business, error: businessError } = await (supabase
            .from('businesses') as any)
            .insert({
                name: businessName.trim(),
            })
            .select()
            .single();

        if (businessError || !business) {
            console.error('[SIGNUP] Business creation error:', businessError);
            return NextResponse.json(
                { error: 'Failed to create business account' },
                { status: 500 }
            );
        }

        // Step 2: Create user and link to business
        const { data: user, error: userError } = await (supabase
            .from('users') as any)
            .insert({
                email: normalizedEmail,
                password_hash: passwordHash,
                name,
                role: 'business',
                business_id: business.id,
            })
            .select()
            .single();

        if (userError || !user) {
            console.error('[SIGNUP] User creation error:', userError);

            // Rollback: Delete the business we just created
            await (supabase
                .from('businesses') as any)
                .delete()
                .eq('id', business.id);

            return NextResponse.json(
                { error: 'Failed to create user account' },
                { status: 500 }
            );
        }

        // Step 3: Update business with user_id (owner) — required for email reports
        const { error: bizLinkError } = await (supabase
            .from('businesses') as any)
            .update({ user_id: user.id })
            .eq('id', business.id);

        if (bizLinkError) {
            // Non-fatal: user and business both exist and are linked via business_id,
            // but weekly report and budget alert emails won't work until user_id is set.
            console.error('[SIGNUP] Failed to link user_id on business (non-fatal):', bizLinkError);
        }

        // Step 4: Pre-create the budget row with the default $10 cap so the
        // Settings > Budget page shows 0 / $10 immediately instead of 0 / 0.
        const { error: budgetError } = await (supabase
            .from('budgets') as any)
            .insert({ business_id: business.id })
            .select()
            .maybeSingle();

        if (budgetError && budgetError.code !== '23505') {
            // 23505 = unique_violation (row already exists — safe to ignore)
            console.warn('[SIGNUP] Budget row creation failed (non-fatal):', budgetError);
        }

        console.log('[SIGNUP] ✅ Account created successfully:', normalizedEmail);

        return NextResponse.json({
            success: true,
            message: 'Account created successfully',
            user: {
                id: user.id,
                email: normalizedEmail,
                name: user.name,
            },
            business: {
                id: business.id,
                name: business.name,
            },
        });

    } catch (error: any) {
        console.error('[SIGNUP] Exception:', error);
        return NextResponse.json(
            { error: 'An error occurred during signup' },
            { status: 500 }
        );
    }
}
