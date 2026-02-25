import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import * as bcrypt from 'bcryptjs';

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

        // Check if email already exists
        const { data: existingUser } = await (supabase
            .from('users') as any)
            .select('id')
            .eq('email', email)
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
                name: businessName,
            })
            .select()
            .single();

        if (businessError || !business) {
            console.error('[SIGNUP] Business creation error:', businessError);
            return NextResponse.json(
                { error: 'Failed to create business account', details: businessError?.message, code: businessError?.code },
                { status: 500 }
            );
        }

        // Step 2: Create user and link to business
        const { data: user, error: userError } = await (supabase
            .from('users') as any)
            .insert({
                email,
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

        // Step 3: Update business with user_id (owner)
        await (supabase
            .from('businesses') as any)
            .update({ user_id: user.id })
            .eq('id', business.id);

        console.log('[SIGNUP] ✅ Account created successfully:', email);

        return NextResponse.json({
            success: true,
            message: 'Account created successfully',
            user: {
                id: user.id,
                email: user.email,
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
            { error: 'An error occurred during signup', details: error.message },
            { status: 500 }
        );
    }
}
