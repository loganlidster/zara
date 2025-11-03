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

// Check if user is admin
async function isAdmin() {
  const cookieStore = cookies();
  const userEmail = cookieStore.get('user_email')?.value;
  
  if (!userEmail) return false;
  
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT is_admin FROM dashboard_users WHERE email = $1',
      [userEmail]
    );
    return result.rows[0]?.is_admin || false;
  } finally {
    client.release();
  }
}

// GET - List all users
export async function GET() {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, email, name, is_admin, created_at FROM dashboard_users ORDER BY id'
      );
      return NextResponse.json({ users: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST - Add new user
export async function POST(request: Request) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { email, password, name, is_admin } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query(
        'INSERT INTO dashboard_users (email, password, name, is_admin) VALUES ($1, $2, $3, $4)',
        [email, password, name, is_admin || false]
      );
      return NextResponse.json({ success: true });
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error adding user:', error);
    return NextResponse.json({ error: 'Failed to add user' }, { status: 500 });
  }
}

// PUT - Update user (toggle admin status)
export async function PUT(request: Request) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id, is_admin } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE dashboard_users SET is_admin = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [is_admin, id]
      );
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE - Remove user
export async function DELETE(request: Request) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Prevent deleting yourself
      const cookieStore = cookies();
      const userEmail = cookieStore.get('user_email')?.value;
      const userResult = await client.query(
        'SELECT email FROM dashboard_users WHERE id = $1',
        [id]
      );
      
      if (userResult.rows[0]?.email === userEmail) {
        return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
      }

      await client.query('DELETE FROM dashboard_users WHERE id = $1', [id]);
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}