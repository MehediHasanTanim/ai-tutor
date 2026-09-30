'use client';

import { useActionState } from 'react';
import { loginAction, type ActionState } from '@/lib/actions';

const initial: ActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action}>
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="field">
        <label htmlFor="identifier">Phone or email</label>
        <input
          id="identifier"
          name="identifier"
          autoComplete="username"
          placeholder="+8801700000001"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <button type="submit" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
