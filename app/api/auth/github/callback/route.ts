import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/review?auth_error=no_code`);
  }

  // Exchange code for token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${baseUrl}/api/auth/github/callback`,
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error || !tokenData.access_token) {
    return NextResponse.redirect(`${baseUrl}/review?auth_error=oauth_failed`);
  }

  // Fetch GitHub username
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  const user = await userRes.json();

  const cookieOpts = {
    httpOnly: false, // must be readable by client JS for GitHub API calls
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  };

  const response = NextResponse.redirect(`${baseUrl}/review`);
  response.cookies.set('gh_token', tokenData.access_token, cookieOpts);
  response.cookies.set('gh_user', user.login || '', cookieOpts);

  return response;
}
