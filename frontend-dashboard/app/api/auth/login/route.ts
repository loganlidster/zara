import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    // Query database for user
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT email, name, is_admin FROM dashboard_users WHERE email = $1 AND password = $2',
        [email?.toLowerCase(), password]
      );
      
      const user = result.rows[0];
      
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
        
        cookies().set('user_is_admin', user.is_admin ? 'true' : 'false', {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
        
        return NextResponse.json({ 
          success: true,
          user: {
            name: user.name,
            email: user.email,
            isAdmin: user.is_admin
          }
        });
      } else {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}