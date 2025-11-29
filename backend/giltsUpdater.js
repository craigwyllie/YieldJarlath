const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const fetch = (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));

const SOURCE_URL = process.env.HL_GILTS_URL || 'https://giltsyield.com/bond/';
const GILTS_PATH = path.join(__dirname, 'gilts.json');

function readGiltsFile() {
  try {
    const raw = fs.readFileSync(GILTS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(String(value).trim());
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function deriveCouponMonths(maturity) {
  const maturityMonth = new Date(maturity).getMonth() + 1;
  const alternate = ((maturityMonth + 5) % 12) + 1;
  return [maturityMonth, alternate];
}

function normalizeFractions(text) {
  if (!text) return text;
  return String(text)
    .replace(/\u00bc/g, '1/4')
    .replace(/\u00bd/g, '1/2')
    .replace(/\u00be/g, '3/4')
    .replace(/\u215b/g, '1/8')
    .replace(/\u215c/g, '3/8')
    .replace(/\u215d/g, '5/8')
    .replace(/\u215e/g, '7/8');
}

function parseCouponRate(val) {
  if (!val) return 0;
  const cleaned = normalizeFractions(val).replace('%', '').trim();
  const parts = cleaned.split(' ');
  let total = 0;
  parts.forEach((p) => {
    if (!p) return;
    if (p.includes('/')) {
      const [n, d] = p.split('/').map((x) => parseFloat(x));
      if (!Number.isNaN(n) && !Number.isNaN(d) && d !== 0) total += n / d;
      return;
    }
    const n = parseFloat(p);
    if (!Number.isNaN(n)) total += n;
  });
  return total / 100;
}

function looksIndexLinked(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return t.includes('index') || t.includes('link') || t.includes('rpi');
}

async function fetchGiltsyieldHtml() {
  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'gilts-monitor/1.0 (+internal)' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parseNumber(text) {
  if (!text) return null;
  const match = String(text).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

async function fetchGiltsyieldGilts() {
  const html = await fetchGiltsyieldHtml();
  const $ = cheerio.load(html);
  const gilts = [];

  $('#bonds-table tbody tr').each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    // Row structure: [star td], [bond th], td0 coupon, td1 issue date, td2 maturity, td3 tenor,
    // td4 clean price, td5 accr, td6 dirty, td7 mod duration, td8 gross, td9 dmo, td10 net.
    if (cells.length < 11) return;

    const bondCell = $row.find('th').first();
    const nameText = normalizeFractions(bondCell.find('a').first().text().trim());
    const metaText = bondCell.text();
    const isinMatch = metaText.match(/GB[0-9A-Z]{10}/);
    const ticker = ($row.attr('data-ticker') || '').trim();

    const couponAttr = parseFloat($row.attr('data-coupon'));
    const couponRate = Number.isFinite(couponAttr) ? couponAttr / 100 : parseCouponRate(cells.eq(1).text());
    const maturityStr = cells.eq(3).text().trim();
    const maturityDate = parseDate(maturityStr);
    const cleanPrice = parseNumber(cells.eq(5).text());

    if (!isinMatch || !maturityDate) return;
    if (looksIndexLinked(nameText)) return;
    if (nameText.toLowerCase().includes('strip')) return;

    gilts.push({
      code: ticker || null,
      name: nameText,
      isin: isinMatch[0],
      maturity: maturityDate.toISOString().split('T')[0],
      couponRate,
      couponMonths: deriveCouponMonths(maturityDate),
      cleanPrice,
    });
  });

  if (gilts.length === 0) {
    throw new Error('giltsyield feed returned no conventional gilts');
  }

  return gilts;
}

async function updateGiltsList() {
  const current = readGiltsFile();
  const fetched = await fetchGiltsyieldGilts();

  const existingIsins = new Set(current.map((g) => g.isin));
  const byIsin = new Map();
  fetched.forEach((g) => byIsin.set(g.isin, g));

  const newList = Array.from(byIsin.values());
  const added = newList.filter((g) => !existingIsins.has(g.isin)).length;

  fs.writeFileSync(GILTS_PATH, JSON.stringify(newList, null, 2));
  console.log(`Fetched ${newList.length} gilts from giltsyield; added ${added} new.`);

  return { added, total: newList.length, wrote: true };
}

module.exports = {
  updateGiltsList,
};
