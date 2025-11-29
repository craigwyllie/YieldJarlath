import { useEffect, useMemo, useState } from 'react';
import Login from './Login.jsx';
import GiltTable from './GiltTable.jsx';
import { TAX_RATES, fetchGilts, getStoredToken, login as apiLogin, clearToken } from './api.js';
import LogoImage from './assets/yieldjarlathlogo.png';

export default function App() {
  const [token, setToken] = useState(getStoredToken());
  const [gilts, setGilts] = useState([]);
  const [taxRate, setTaxRate] = useState(0.2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [couponFilter, setCouponFilter] = useState('all'); // all | low | high
  const [maturityFilter, setMaturityFilter] = useState('all'); // all | short | medium | long

  const handleLogin = async (username, password) => {
    const t = await apiLogin(username, password);
    setToken(t);
  };

  const handleLogout = () => {
    clearToken();
    setToken(null);
    setGilts([]);
  };

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const couponParams =
      couponFilter === 'low'
        ? { couponMax: 2 }
        : couponFilter === 'high'
        ? { couponMin: 2.0001 }
        : {};

    const maturityParams = (() => {
      const now = new Date();
      const addYears = (years) => {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() + years);
        return d.toISOString().split('T')[0];
      };
      if (maturityFilter === 'short') return { maturityTo: addYears(5) };
      if (maturityFilter === 'medium') return { maturityFrom: addYears(5), maturityTo: addYears(10) };
      if (maturityFilter === 'long') return { maturityFrom: addYears(10) };
      return {};
    })();

    try {
      const data = await fetchGilts(
        {
          taxRate,
          ...couponParams,
          ...maturityParams,
        },
        token
      );
      setGilts(data.gilts || []);
      setLastUpdated(data.lastUpdated);
    } catch (err) {
      if (err.message === 'Unauthorized') {
        handleLogout();
      } else {
        setError(err.message || 'Failed to fetch data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedGilts = useMemo(() => {
    const copy = [...gilts];
    copy.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'maturityDisplay' || sortField === 'maturity') {
        aVal = new Date(a.maturity).getTime();
        bVal = new Date(b.maturity).getTime();
      } else if (sortField === 'timeToMaturity' && a.timeToMaturityDays !== undefined) {
        aVal = a.timeToMaturityDays;
        bVal = b.timeToMaturityDays;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dir;
      }

      return String(aVal).localeCompare(String(bVal)) * dir;
    });
    return copy;
  }, [gilts, sortDirection, sortField]);

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(56,189,248,0.18),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(14,165,233,0.16),transparent_28%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="panel-strong flex flex-col gap-4 px-5 py-5 shadow-2xl shadow-cyan-500/15 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img
              src={LogoImage}
              alt="Gilt monitor logo"
              className="h-14 w-14 rounded-2xl object-cover shadow-md border border-slate-200"
            />
            <div className="space-y-1">
              <span className="pill w-fit">Gilts dashboard</span>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">UK Gilts Monitor</h1>
              {lastUpdated && (
                <p className="text-xs text-slate-500">
                  Last updated {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input w-48"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value))}
            >
              {TAX_RATES.map((r) => (
                <option key={r.value} value={r.value}>
                  Tax rate: {r.label}
                </option>
              ))}
            </select>
            <button className="btn-ghost" onClick={loadData} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="btn-ghost" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <div className="panel space-y-3 px-4 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base font-semibold text-slate-900">Filter gilts</p>
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-900">{sortedGilts.length}</span> gilts
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="label">Coupon</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'low', label: 'Low (≤2%)' },
                  { key: 'high', label: 'High (>2%)' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition border ${
                      couponFilter === opt.key
                        ? 'bg-accent-100 text-slate-900 border-accent-200 shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    onClick={() => setCouponFilter(opt.key)}
                    disabled={loading}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="label">Maturity</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'short', label: 'Short (≤5y)' },
                  { key: 'medium', label: 'Medium (5–10y)' },
                  { key: 'long', label: 'Long (10y+)' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition border ${
                      maturityFilter === opt.key
                        ? 'bg-accent-100 text-slate-900 border-accent-200 shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    onClick={() => setMaturityFilter(opt.key)}
                    disabled={loading}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="panel border border-red-200 bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}

        <GiltTable gilts={sortedGilts} sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
      </div>
    </div>
  );
}
