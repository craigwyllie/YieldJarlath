const crypto = require('crypto');
const cheerio = require('cheerio');

// Lazy import to keep compatibility with CommonJS without ESM flags.
const fetch = (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));

const SOURCE_URL = process.env.HL_GILTS_URL || 'https://giltsyield.com/bond/';

/**
 * Generates a deterministic pseudo-random offset for a given ISIN so that
 * offline environments still produce stable prices.
 */
function hashOffset(isin) {
  const hash = crypto.createHash('md5').update(isin).digest('hex');
  const int = parseInt(hash.substring(0, 6), 16);
  return (int % 1000) / 1000 - 0.5; // range roughly [-0.5, 0.5]
}

/**
 * Build a synthetic clean price around par using coupon rate, time to maturity,
 * and a deterministic offset. Keeps app functional when no live data exists.
 */
function buildOfflinePrice(gilt, now = new Date()) {
  const maturity = new Date(gilt.maturity);
  const msToMaturity = Math.max(0, maturity - now);
  const yearsToMaturity = msToMaturity / (365.25 * 24 * 60 * 60 * 1000);
  const couponPct = (gilt.couponRate || 0) * 100;
  const drift = Math.max(-3, Math.min(3, (couponPct - 2) * 0.6));
  const timeDecay = -0.35 * Math.tanh(yearsToMaturity / 10);
  const synthetic = 100 + drift + timeDecay + hashOffset(gilt.isin);
  return Math.max(60, Math.min(140, Number(synthetic.toFixed(2))));
}

/**
 * Attempt to fetch live prices from a custom endpoint if PRICE_FEED_URL is set.
 * The endpoint is expected to return an object mapping ISIN to clean price.
 */
async function fetchLivePrices(gilts) {
  if (process.env.PRICE_FEED_URL) {
    try {
      const response = await fetch(process.env.PRICE_FEED_URL);
      if (!response.ok) {
        throw new Error(`Live feed responded with ${response.status}`);
      }
      const data = await response.json();
      const prices = {};
      gilts.forEach((g) => {
        if (data[g.isin]) {
          prices[g.isin] = Number(data[g.isin]);
        }
      });
      return prices;
    } catch (err) {
      console.error('Live price fetch failed, falling back to offline pricing:', err.message);
    }
  }
  return null;
}

async function fetchCleanPrices(gilts) {
  const now = new Date();
  const prices = {};
  const live = await fetchLivePrices(gilts);
  const sitePrices = await fetchGiltsyieldPrices();

  for (const gilt of gilts) {
    const clean =
      (live && live[gilt.isin]) ||
      (sitePrices && sitePrices[gilt.isin]) ||
      gilt.cleanPrice ||
      buildOfflinePrice(gilt, now);
    prices[gilt.isin] = { cleanPrice: clean, timestamp: now };
  }

  return prices;
}

function parseNumber(text) {
  if (!text) return null;
  const match = String(text).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

async function fetchGiltsyieldPrices() {
  try {
    const response = await fetch(SOURCE_URL, {
      headers: { 'User-Agent': 'gilts-monitor/1.0 (+internal)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    const map = {};
    $('#bonds-table tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      // Row structure: [star td], [bond th], td0 coupon, td1 issue date, td2 maturity, td3 tenor,
      // td4 clean price, td5 accr, td6 dirty, td7 mod duration, td8 gross, td9 dmo, td10 net.
      if (cells.length < 11) return;
      const bondCell = $row.find('th').first();
      const metaText = bondCell.text();
      const isinMatch = metaText.match(/GB[0-9A-Z]{10}/);
      const cleanPrice = parseNumber(cells.eq(5).text());
      if (isinMatch && cleanPrice != null) {
        map[isinMatch[0]] = cleanPrice;
      }
    });
    return map;
  } catch (err) {
    console.error('giltsyield price fetch failed:', err.message);
    return null;
  }
}

module.exports = {
  fetchCleanPrices,
  buildOfflinePrice,
};
