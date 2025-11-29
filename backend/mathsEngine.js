function addMonths(date, months) {
  // Month-safe add: preserves end-of-month by clamping to last day in target month.
  const source = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = source.getUTCDate();
  const target = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

function diffInDays(later, earlier) {
  const ms = later.getTime() - earlier.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function buildCouponSchedule(gilt, valuationDate = new Date()) {
  const maturityDate = new Date(gilt.maturity);
  const day = maturityDate.getUTCDate();
  const futureCoupons = [];
  let cursor = new Date(Date.UTC(maturityDate.getUTCFullYear(), maturityDate.getUTCMonth(), maturityDate.getUTCDate()));
  let guard = 0;

  // Step backwards in 6-month increments to build a semi-annual schedule.
  while (cursor >= valuationDate && guard < 200) {
    futureCoupons.unshift(new Date(cursor.getTime()));
    cursor = addMonths(cursor, -6);
    guard += 1;
  }

  // Ensure we have at least one forward coupon after valuation date.
  const nextCoupon = futureCoupons.find((c) => c >= valuationDate) || addMonths(cursor, 6);
  const lastCoupon = addMonths(nextCoupon, -6);

  // Normalise day for all coupons (clamp to month end).
  const normalisedCoupons = futureCoupons.map((c) => {
    const normalised = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), 1));
    const lastDay = new Date(Date.UTC(normalised.getUTCFullYear(), normalised.getUTCMonth() + 1, 0)).getUTCDate();
    normalised.setUTCDate(Math.min(day, lastDay));
    return normalised;
  });

  return { futureCoupons: normalisedCoupons, lastCoupon, nextCoupon, maturityDate };
}

function calculateDirtyPrice(gilt, cleanPrice, valuationDate = new Date()) {
  const { lastCoupon, nextCoupon } = buildCouponSchedule(gilt, valuationDate);
  if (!nextCoupon) {
    return Number(cleanPrice.toFixed(4));
  }

  const couponPayment = 100 * (gilt.couponRate || 0) / 2;
  const last = lastCoupon || addMonths(nextCoupon, -6);
  const daysSince = diffInDays(valuationDate, last);
  const daysPeriod = diffInDays(nextCoupon, last);
  const accrued = daysPeriod > 0 ? couponPayment * (daysSince / daysPeriod) : 0;
  const dirty = cleanPrice + accrued;
  return Number(dirty.toFixed(4));
}

function buildCashflows(gilt, dirtyPrice, taxRate = 0, valuationDate = new Date()) {
  const { futureCoupons, maturityDate } = buildCouponSchedule(gilt, valuationDate);
  const couponPayment = 100 * (gilt.couponRate || 0) / 2;
  const flows = [{ amount: -dirtyPrice, when: valuationDate }];

  futureCoupons.forEach((date) => {
    const principal = date.toDateString() === maturityDate.toDateString() ? 100 : 0;
    const taxedCoupon = couponPayment * (1 - taxRate);
    flows.push({
      amount: principal + taxedCoupon,
      when: date,
    });
  });

  return flows;
}

function calculateYTM(gilt, dirtyPrice, taxRate = 0, valuationDate = new Date()) {
  const cashflows = buildCashflows(gilt, dirtyPrice, taxRate, valuationDate);
  if (cashflows.length < 2) return null;

  try {
    const irr = computeXirr(cashflows);
    return irr === null ? null : Number((irr * 100).toFixed(3));
  } catch (err) {
    console.warn(`YTM calculation failed for ${gilt.isin}: ${err.message}`);
    return null;
  }
}

function computeXirr(cashflows) {
  const sorted = [...cashflows].sort((a, b) => a.when - b.when);
  const start = sorted[0].when;

  const npv = (rate) =>
    sorted.reduce((acc, cf) => {
      const days = diffInDays(cf.when, start);
      const factor = Math.pow(1 + rate, days / 365.25);
      return acc + cf.amount / factor;
    }, 0);

  let low = -0.9999;
  let high = 5;
  let fLow = npv(low);
  let fHigh = npv(high);

  // Expand high bound if signs match
  let guard = 0;
  while (fLow * fHigh > 0 && guard < 10) {
    high += 5;
    fHigh = npv(high);
    guard += 1;
  }

  if (fLow * fHigh > 0) {
    return null; // cannot solve
  }

  let mid = 0;
  for (let i = 0; i < 100; i += 1) {
    mid = (low + high) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) break;
    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return mid;
}

module.exports = {
  calculateDirtyPrice,
  calculateYTM,
  buildCashflows,
  buildCouponSchedule,
  addMonths,
  diffInDays,
  computeXirr,
};
