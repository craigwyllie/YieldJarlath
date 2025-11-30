const HEADERS = [
  { key: 'code', label: 'Code', numeric: false },
  { key: 'name', label: 'Name', numeric: false },
  { key: 'isin', label: 'ISIN', numeric: false, hiddenUntil: 'xl' },
  { key: 'maturityDisplay', label: 'Maturity', numeric: false },
  { key: 'timeToMaturity', label: 'TTM', numeric: false, hiddenUntil: 'xl' },
  { key: 'cleanPrice', label: 'Clean', numeric: true },
  { key: 'grossYTM', label: 'Gross YTM', numeric: true },
  { key: 'netYTM', label: 'Net YTM', numeric: true },
  { key: 'couponRate', label: 'Coupon', numeric: true, hiddenUntil: 'xl' },
];

function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(decimals);
}

export default function GiltTable({ gilts, sortField, sortDirection, onSort }) {
  const renderSort = (key) => {
    if (sortField !== key) return '';
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  const headerVisibility = (hiddenUntil) => {
    if (hiddenUntil === 'xl') return 'hidden xl:table-cell';
    if (hiddenUntil === 'lg') return 'hidden lg:table-cell';
    if (hiddenUntil === 'md') return 'hidden md:table-cell';
    return '';
  };

  const cardIndicator = (key) => (sortField === key ? (sortDirection === 'asc' ? '▲' : '▼') : '');

  const cardSortProps = (key) => ({
    role: 'button',
    tabIndex: 0,
    onClick: () => onSort(key),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSort(key);
      }
    },
  });

  return (
    <div className="panel space-y-4 px-6 py-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Results</h2>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Tap a heading to sort</p>
        </div>
      </div>

      {/* Desktop / landscape table (from sm up, with hidden columns for space) */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden hidden sm:block">
        <table className="w-full table-fixed text-[10px] sm:text-[11px] text-slate-900">
          <thead className="bg-slate-50 text-[9px] uppercase tracking-[0.08em] text-slate-500">
            <tr>
              {HEADERS.map((h) => (
                <th
                  key={h.key}
                  onClick={() => onSort(h.key)}
                  className={`cursor-pointer whitespace-nowrap px-2 py-2 sm:px-2.5 sm:py-2 font-semibold hover:text-slate-900 ${
                    h.numeric ? 'text-right' : 'text-left'
                  } ${headerVisibility(h.hiddenUntil)}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {h.label}
                    <span className="text-[10px] text-accent-500">{renderSort(h.key)}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gilts.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={HEADERS.length}>
                  No gilts match these filters yet.
                </td>
              </tr>
            )}
            {gilts.map((gilt, idx) => (
              <tr
                key={gilt.isin}
                className={idx % 2 === 0 ? 'bg-slate-50/70 hover:bg-slate-100 transition' : 'hover:bg-slate-100 transition'}
              >
                <td className="px-2 py-2 sm:px-2 sm:py-2 font-semibold text-slate-900 w-[56px] sm:w-[64px] whitespace-nowrap">
                  {gilt.code || '-'}
                </td>
                <td className="px-2 py-2 sm:px-2.5 sm:py-2">
                  <div className="text-slate-800 leading-snug break-words line-clamp-2">{gilt.name}</div>
                </td>
                <td className={`px-2 py-2 sm:px-2.5 sm:py-2 ${headerVisibility(HEADERS.find((h) => h.key === 'isin').hiddenUntil)}`}>
                  <span className="rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-700">
                    {gilt.isin}
                  </span>
                </td>
                <td className="px-2 py-2 sm:px-2.5 sm:py-2 whitespace-nowrap text-slate-800">
                  {gilt.maturityDisplay || gilt.maturity || '-'}
                </td>
                <td
                  className={`px-2 py-2 sm:px-2 sm:py-2 whitespace-nowrap text-slate-700 w-[70px] sm:w-[88px] ${headerVisibility(
                    HEADERS.find((h) => h.key === 'timeToMaturity').hiddenUntil
                  )}`}
                >
                  {gilt.timeToMaturity || '-'}
                </td>
                <td className="px-2 py-2 sm:px-2.5 sm:py-2 text-right font-semibold text-slate-900 tabular-nums">
                  {formatNumber(gilt.cleanPrice, 3)}
                </td>
                <td className="px-2 py-2 sm:px-2.5 sm:py-2 text-right tabular-nums">{formatNumber(gilt.grossYTM, 3)}%</td>
                <td className="px-2 py-2 sm:px-2.5 sm:py-2 text-right font-semibold text-emerald-600 tabular-nums">
                  {formatNumber(gilt.netYTM, 3)}%
                </td>
                <td className={`px-2 py-2 sm:px-2.5 sm:py-2 text-right tabular-nums ${headerVisibility(
                  HEADERS.find((h) => h.key === 'couponRate').hiddenUntil
                )}`}>
                  {formatNumber(gilt.couponRate * 100, 3)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards (portrait only) */}
      <div className="space-y-3 sm:hidden">
        {gilts.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500 text-center">
            No gilts match these filters yet.
          </div>
        )}
        {gilts.map((gilt) => (
          <div key={gilt.isin} className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1 cursor-pointer" {...cardSortProps('code')}>
                  {gilt.code || '-'} <span className="text-[10px]">{cardIndicator('code')}</span>
                </div>
                <div className="text-sm text-slate-700 leading-snug inline-flex items-center gap-1 cursor-pointer" {...cardSortProps('name')}>
                  {gilt.name} <span className="text-[10px]">{cardIndicator('name')}</span>
                </div>
              </div>
              <div
                className="rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-700 inline-flex items-center gap-1 cursor-pointer"
                {...cardSortProps('isin')}
              >
                {gilt.isin} <span className="text-[10px]">{cardIndicator('isin')}</span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
              <div className="text-left cursor-pointer" {...cardSortProps('maturity')}>
                <p className="font-semibold text-slate-900 inline-flex items-center gap-1">
                  Maturity <span className="text-[10px]">{cardIndicator('maturity')}</span>
                </p>
                <p>{gilt.maturityDisplay || gilt.maturity || '-'}</p>
              </div>
              <div className="text-left cursor-pointer" {...cardSortProps('cleanPrice')}>
                <p className="font-semibold text-slate-900 inline-flex items-center gap-1">
                  Clean <span className="text-[10px]">{cardIndicator('cleanPrice')}</span>
                </p>
                <p className="tabular-nums">{formatNumber(gilt.cleanPrice, 3)}</p>
              </div>
              <div className="text-left cursor-pointer" {...cardSortProps('grossYTM')}>
                <p className="font-semibold text-slate-900 inline-flex items-center gap-1">
                  Gross YTM <span className="text-[10px]">{cardIndicator('grossYTM')}</span>
                </p>
                <p className="tabular-nums text-slate-900">{formatNumber(gilt.grossYTM, 3)}%</p>
              </div>
              <div className="text-left cursor-pointer" {...cardSortProps('netYTM')}>
                <p className="font-semibold text-slate-900 inline-flex items-center gap-1">
                  Net YTM <span className="text-[10px]">{cardIndicator('netYTM')}</span>
                </p>
                <p className="tabular-nums text-emerald-700">{formatNumber(gilt.netYTM, 3)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
