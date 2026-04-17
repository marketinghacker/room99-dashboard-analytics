'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'login failed');
      }
      router.replace(next);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[380px] card p-8">
      <div className="mb-6">
        <div
          className="text-[10px] font-mono tracking-[0.14em] uppercase"
          style={{ color: 'var(--color-ink-tertiary)' }}
        >
          № 03 · Room99 Dashboard
        </div>
        <h1
          className="text-[32px] mt-2"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          Zaloguj się, <em style={{ color: 'var(--color-accent)' }}>aby kontynuować.</em>
        </h1>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="overline">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 px-3 rounded-[8px] bg-[var(--color-bg-card)] border border-[var(--color-line-soft)] focus:border-[var(--color-accent)] outline-none text-[14px]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="overline">Hasło</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 px-3 rounded-[8px] bg-[var(--color-bg-card)] border border-[var(--color-line-soft)] focus:border-[var(--color-accent)] outline-none text-[14px]"
          />
        </label>

        {err && (
          <div
            className="text-[12px] px-3 py-2 rounded-[6px]"
            style={{
              background: 'var(--color-accent-negative-bg)',
              color: 'var(--color-accent-negative)',
            }}
          >
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="h-10 mt-2 rounded-[8px] text-[14px] font-medium text-white transition disabled:opacity-50"
          style={{ background: 'var(--color-accent)' }}
        >
          {busy ? 'Loguję…' : 'Zaloguj'}
        </button>
      </form>

      <div
        className="mt-6 pt-4 border-t text-[11px] text-center"
        style={{
          borderColor: 'var(--color-line-soft)',
          color: 'var(--color-ink-tertiary)',
        }}
      >
        Hasło otrzymujesz od agencji. Kontakt:{' '}
        <a href="mailto:marcin@marketing-hackers.com" style={{ color: 'var(--color-accent)' }}>
          marcin@marketing-hackers.com
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <Suspense fallback={<div className="card p-8 w-[380px]">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
