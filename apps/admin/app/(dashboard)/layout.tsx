import { redirect } from 'next/navigation';
import { readSession } from '@/lib/session';
import { Nav } from '@/components/nav';
import { logoutAction } from '@/lib/actions';

/**
 * Auth guard for every dashboard route.
 *
 * A cookie check only — it proves a session exists, not that it is valid or
 * that the account is still an admin. The API enforces RBAC on every request,
 * so this is a redirect for comprehensibility, never the security boundary.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await readSession())) redirect('/login');

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>
          AI Tutor
          <small>Knowledge base</small>
        </h1>
        <Nav />
        <form action={logoutAction} style={{ marginTop: 'auto' }}>
          <button type="submit" className="secondary" style={{ width: '100%' }}>
            Sign out
          </button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
