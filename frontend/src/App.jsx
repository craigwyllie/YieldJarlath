import { useEffect, useMemo, useState } from 'react';
import Login from './Login.jsx';
import GiltTable from './GiltTable.jsx';
import { TAX_RATES, fetchGilts, getStoredToken, login as apiLogin, clearToken } from './api.js';

export default function App() {
  const [token, setToken] = useState(getStoredToken());
  const [gilts, setGilts] = useState([]);
  const [taxRate, setTaxRate] = useState(0.2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [couponMin, setCouponMin] = useState('');
  const [couponMax, setCouponMax] = useState('');
  const [maturityFrom, setMaturityFrom] = useState('');
  const [maturityTo, setMaturityTo] = useState('');

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
    try {
      const data = await fetchGilts(
        {
          taxRate,
          couponMin: couponMin === '' ? undefined : couponMin,
          couponMax: couponMax === '' ? undefined : couponMax,
          maturityFrom: maturityFrom || undefined,
          maturityTo: maturityTo || undefined,
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
  }, [token, taxRate, couponMin, couponMax, maturityFrom, maturityTo]);

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

      <div className="relative mx-auto max-w-6xl space-y-8 px-4 py-10">
        <header className="panel-strong flex flex-col gap-6 px-6 py-7 shadow-2xl shadow-cyan-500/15 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <span className="pill w-fit">Gilts dashboard</span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">UK Gilts Monitor</h1>
              <p className="text-sm text-slate-600 sm:text-base">
                Clean/dirty prices direct from HL with gross and net YTM after your marginal tax rate.
              </p>
            </div>
            {lastUpdated && (
              <p className="text-xs text-slate-500">
                Last updated {new Date(lastUpdated).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
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

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="panel space-y-5 px-6 py-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold text-slate-900">Filter gilts</p>
                <p className="text-sm text-slate-500">Tune coupon and maturity ranges, then apply.</p>
              </div>
              <div className="text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-900">{sortedGilts.length}</span> gilts
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="label">Coupon min (%)</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={couponMin}
                  onChange={(e) => setCouponMin(e.target.value)}
                  placeholder="e.g. 0.50"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="label">Coupon max (%)</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={couponMax}
                  onChange={(e) => setCouponMax(e.target.value)}
                  placeholder="e.g. 5.00"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="label">Maturity from</span>
                <input
                  className="input"
                  type="date"
                  value={maturityFrom}
                  onChange={(e) => setMaturityFrom(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="label">Maturity to</span>
                <input
                  className="input"
                  type="date"
                  value={maturityTo}
                  onChange={(e) => setMaturityTo(e.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="btn-ghost"
                onClick={() => {
                  setCouponMin('');
                  setCouponMax('');
                  setMaturityFrom('');
                  setMaturityTo('');
                }}
                disabled={loading}
              >
                Clear
              </button>
              <button className="btn-primary" onClick={loadData} disabled={loading}>
                {loading ? 'Loading...' : 'Apply filters'}
              </button>
            </div>
          </div>

          <div className="panel space-y-3 px-6 py-6">
            <p className="label">Quick tips</p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>• Tax rate drives net YTM; select yours before sorting.</li>
              <li>• Coupon filters accept decimals (e.g. 0.25 for sub‑1% coupons).</li>
              <li>• Click column headers to sort; maturity sorting is chronological.</li>
            </ul>
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
