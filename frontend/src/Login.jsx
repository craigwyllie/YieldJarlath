import { useState } from 'react';
import LogoImage from './assets/yieldjarlathlogo.png';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(56,189,248,0.12),transparent_32%),radial-gradient(circle_at_82%_10%,rgba(14,165,233,0.12),transparent_26%)]" />
      </div>

      <div className="panel relative w-full max-w-md space-y-6 px-6 py-8">
        <div className="flex items-center gap-3">
          <img
            src={LogoImage}
            alt="Gilt monitor logo"
            className="h-12 w-12 rounded-2xl object-cover shadow-md border border-slate-200"
          />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">UK Gilts Monitor</h1>
            <p className="pill mt-1 w-fit">Secure access</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex flex-col gap-2 text-sm text-slate-800">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Username</span>
            <input
              className="input"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-800">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Password</span>
            <input
              className="input"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </button>
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
