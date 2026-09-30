import { redirect } from 'next/navigation';
import { readSession } from '@/lib/session';
import { LoginForm } from '@/components/login-form';

export default async function LoginPage() {
  if (await readSession()) redirect('/documents');

  return (
    <main className="login-shell">
      <div className="card login-card">
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Knowledge Base Admin</h2>
        <p className="muted small" style={{ marginTop: 0, marginBottom: 20 }}>
          Administrator accounts only.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
