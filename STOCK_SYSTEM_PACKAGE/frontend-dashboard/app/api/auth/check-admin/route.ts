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

export async function GET() {
  try {
    const cookieStore = cookies();
    const userEmail = cookieStore.get('user_email')?.value;
    
    if (!userEmail) {
      return NextResponse.json({ isAdmin: false });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT is_admin FROM dashboard_users WHERE email = $1',
        [userEmail]
      );
      
      return NextResponse.json({ 
        isAdmin: result.rows[0]?.is_admin || false 
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json({ isAdmin: false });
  }
}