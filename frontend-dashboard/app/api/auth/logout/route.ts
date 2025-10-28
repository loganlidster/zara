import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  // Delete authentication cookie
  cookies().delete('authenticated');
  
  return NextResponse.json({ success: true });
}