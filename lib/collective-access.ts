/** App metadata must come from Auth getUser(), never a browser-supplied object. */
export function collectiveRole(user: {
  is_anonymous?: boolean;
  email_confirmed_at?: string | null;
  app_metadata?: Record<string, unknown>;
} | null): 'contributor' | 'partner' | null {
  if (!user || user.is_anonymous || !user.email_confirmed_at) return null;
  const value = user.app_metadata?.hosting_collective;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const access = value as Record<string, unknown>;
  if (access.status !== 'active') return null;
  return access.role === 'contributor' || access.role === 'partner' ? access.role : null;
}

/** Exact segment matching keeps /hosting-collective public. */
export function requiresAccount(pathname: string): boolean {
  return pathname === '/host' || pathname.startsWith('/host/') ||
    pathname === '/hosting-collective/hub' || pathname.startsWith('/hosting-collective/hub/');
}
