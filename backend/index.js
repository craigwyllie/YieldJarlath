require('dotenv').config();

// Polyfill File for environments where undici/node-fetch expects it (Node 18 on Render may lack global File).
if (typeof File === 'undefined' && typeof Blob !== 'undefined') {
  global.File = class File extends Blob {
    constructor(parts, name, options = {}) {
      super(parts, options);
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
    }
  };
}
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { authMiddleware } = require('./auth');
const { fetchCleanPrices } = require('./priceFetcher');
const { calculateDirtyPrice, calculateYTM } = require('./mathsEngine');
const { updateGiltsList } = require('./giltsUpdater');

const PORT = process.env.PORT || 4000;
const GILTS_PATH = path.join(__dirname, 'gilts.json');

function loadGilts() {
  try {
    const raw = fs.readFileSync(GILTS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

let gilts = loadGilts();
let priceCache = { timestamp: null, data: {} };
const PRICE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function refreshPrices() {
  try {
    const cleanPrices = await fetchCleanPrices(gilts);
    const now = new Date();
    const data = {};

    gilts.forEach((gilt) => {
      const cleanInfo = cleanPrices[gilt.isin] || { cleanPrice: 100, timestamp: now };
      const cleanPrice = Number(cleanInfo.cleanPrice.toFixed(3));
      const dirtyPrice = calculateDirtyPrice(gilt, cleanPrice, now);
      const grossYTM = calculateYTM(gilt, dirtyPrice, 0, now);

      data[gilt.isin] = {
        cleanPrice,
        dirtyPrice,
        grossYTM,
        timestamp: now,
      };
    });

    priceCache = { timestamp: now, data };
    console.log(`Prices refreshed at ${now.toISOString()}`);
  } catch (err) {
    console.error('Price refresh failed:', err.message);
  }
}

async function ensurePricesFresh() {
  const now = Date.now();
  if (!priceCache.timestamp || now - new Date(priceCache.timestamp).getTime() > PRICE_TTL_MS) {
    await refreshPrices();
  }
}

async function refreshGiltsList() {
  const result = await updateGiltsList();
  gilts = loadGilts();
  await refreshPrices();
  return result;
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(authMiddleware);

app.get('/gilts', async (req, res) => {
  // If we have no gilts loaded, attempt a refresh; otherwise keep the cached list.
  if (!gilts || gilts.length === 0) {
    try {
      await refreshGiltsList();
    } catch (err) {
      console.error('Initial gilt list refresh failed during request:', err.message);
    }
  }

  const allowedRates = [0, 0.2, 0.4, 0.45];
  const requestedRate = parseFloat(req.query.taxRate);
  const taxRate = allowedRates.includes(requestedRate) ? requestedRate : 0;

  if (!priceCache.timestamp) {
    await refreshPrices();
  } else {
    await ensurePricesFresh();
  }

  const now = new Date();
  const couponMin = req.query.couponMin ? parseFloat(req.query.couponMin) : null;
  const couponMax = req.query.couponMax ? parseFloat(req.query.couponMax) : null;
  const maturityFrom = req.query.maturityFrom ? new Date(req.query.maturityFrom) : null;
  const maturityTo = req.query.maturityTo ? new Date(req.query.maturityTo) : null;

  const filtered = gilts.filter((g) => {
    if (couponMin !== null && (g.couponRate || 0) * 100 < couponMin) return false;
    if (couponMax !== null && (g.couponRate || 0) * 100 > couponMax) return false;
    const matDate = new Date(g.maturity);
    if (maturityFrom && matDate < maturityFrom) return false;
    if (maturityTo && matDate > maturityTo) return false;
    return true;
  });

  if (!filtered || filtered.length === 0) {
    return res.status(503).json({ error: 'No gilts available from configured sources' });
  }

  const giltsPayload = filtered.map((g) => {
    const cached = priceCache.data[g.isin] || {};
    const cleanPrice = cached.cleanPrice ?? 100;
    const dirtyPrice = cached.dirtyPrice ?? calculateDirtyPrice(g, cleanPrice, now);
    const grossYTMRaw = cached.grossYTM ?? calculateYTM(g, dirtyPrice, 0, now);
    const netYTMRaw = calculateYTM(g, dirtyPrice, taxRate, now);
    const grossYTM = grossYTMRaw != null ? Number(grossYTMRaw.toFixed(3)) : null;
    const netYTM = netYTMRaw != null ? Number(netYTMRaw.toFixed(3)) : null;
    const maturityDate = new Date(g.maturity);
    const maturityDisplay = [
      String(maturityDate.getDate()).padStart(2, '0'),
      maturityDate.toLocaleString('en-GB', { month: 'short' }),
      String(maturityDate.getFullYear()).slice(-2),
    ].join('-');
    const daysToMaturity = Math.max(0, Math.floor((maturityDate - now) / (1000 * 60 * 60 * 24)));
    const years = Math.floor(daysToMaturity / 365.25);
    const remainingDays = Math.max(0, Math.round(daysToMaturity - years * 365.25));
    const timeToMaturity = `${years}y ${remainingDays}d`;

    return {
      name: g.name,
      code: g.code,
      isin: g.isin,
      maturity: g.maturity,
      maturityDisplay,
      timeToMaturity,
      timeToMaturityDays: daysToMaturity,
      cleanPrice: Number(cleanPrice.toFixed(3)),
      dirtyPrice: Number(dirtyPrice.toFixed(3)),
      grossYTM,
      netYTM,
      couponRate: g.couponRate,
    };
  });

  res.json({
    lastUpdated: priceCache.timestamp,
    count: giltsPayload.length,
    gilts: giltsPayload,
    taxRate,
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, gilts: gilts.length, prices: !!priceCache.timestamp });
});

// Bootstrap: fetch gilts then prices.
(async () => {
  try {
    await refreshGiltsList();
    if (!priceCache.timestamp) {
      await refreshPrices();
    }
  } catch (err) {
    console.error('Initial gilt refresh failed:', err.message);
  }
})();

cron.schedule('0 * * * *', refreshPrices); // hourly
cron.schedule('15 2 * * *', refreshGiltsList); // daily discovery

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
