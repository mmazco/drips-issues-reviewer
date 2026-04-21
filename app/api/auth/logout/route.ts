import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
  const response = NextResponse.redirect(`${baseUrl}/review`);
  response.cookies.delete('gh_token');
  response.cookies.delete('gh_user');
  return response;
}
