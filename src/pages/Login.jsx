import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { extractError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Input';
import hospitalLogo from '../assets/KHC-logo.svg';

export default function Login() {
  const loc = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const user = await login(username, pin);
      const from = loc.state?.from;
      const dest = from && from !== '/login' ? from : '/dashboard';
      window.location.href = dest;
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-900/5">
        <div className="mb-1 flex flex-col items-center text-center">
          <img
            src={hospitalLogo}
            alt="Karunya Hrudayalaya Cardiac Center"
            className="h-20 w-auto max-w-[220px] object-contain"
          />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 text-center">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500 text-center">Enter your username and PIN.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Username">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>
          <Field label="PIN" hint="4–6 digits">
            <Input
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          {err && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
              {err}
            </div>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
