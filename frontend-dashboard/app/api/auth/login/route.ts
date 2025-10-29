import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// User database - in production, this should be in a real database
const USERS = [
  {
    email: 'logan@ninjatech.ai',
    password: process.env.DASHBOARD_PASSWORD || 'tradiac2024',
    name: 'Logan'
  },
  {
    email: 'aaronstubblefield@gmail.com',
    password: 'Wohler1',
    name: 'Aaron'
  }
];

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    // Find user by email and password
    const user = USERS.find(u => 
      u.email.toLowerCase() === email?.toLowerCase() && 
      u.password === password
    );
    
    if (user) {
      // Set authentication cookie with user info
      cookies().set('authenticated', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      
      // Set user info cookie (not sensitive data)
      cookies().set('user_name', user.name, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      
      cookies().set('user_email', user.email, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      
      return NextResponse.json({ 
        success: true,
        user: {
          name: user.name,
          email: user.email
        }
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}