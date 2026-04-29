"use client";
import { useState, useEffect } from 'react';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

// Reads the GitHub OAuth cookies set by /api/auth/github/callback. The
// `loading` flag exists so callers can avoid rendering "Connect GitHub"
// during the brief gap between first paint and the cookie check —
// otherwise hydration shows a misleading "signed out" state for one
// frame on every page load.
export function useGitHubAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setToken(getCookie('gh_token'));
    setUsername(getCookie('gh_user'));
    setLoading(false);
  }, []);

  return { token, username, isConnected: !!token, loading };
}
