# Gilts Dashboard

Full-stack app for viewing UK gilts with authentication, dirty price calculation, and automatic updates.

## Tech
- Backend: Node.js (Express, cron, cheerio, xirr)
- Frontend: React + Vite
- Auth: HTTP Basic (username/password from `.env`)

## Project Structure
```
backend/   Express API, pricing engine, cron jobs
frontend/  React UI (login + gilt table)
render.yaml Render deployment definition
```

## Setup
1. Copy environment variables:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Set `USERNAME`, `PASSWORD`, `PORT`. Source configuration:
   - `HL_GILTS_URL` (default points to HL gilts prices page).

2. Install dependencies:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

## Local Development
- Install everything (root command installs backend + frontend deps):
  ```bash
  npm install
  ```
- Start both backend and frontend together (single command):
  ```bash
  npm run dev
  ```
  - Backend: http://localhost:4000
  - Frontend: http://localhost:5173
- You can still run them separately if needed:
  ```bash
  cd backend && npm start
  cd frontend && npm run dev
  ```
- Login with the credentials from `backend/.env`. The UI stores the Base64 token in `localStorage`.

## API
`GET /gilts?taxRate=0.2` (requires Basic Auth header)
- Returns clean price, dirty price, gross/net YTM, coupon rate, ISIN, maturity.
- `taxRate` accepted values: `0`, `0.2`, `0.4`, `0.45`.
- Optional filters: `couponMin`/`couponMax` (percent), `maturityFrom`/`maturityTo` (ISO date).

## Pricing & Updates
- Hourly cron refreshes clean/dirty prices (synthetic prices if no live feed configured).
- Gilt universe and codes/prices are pulled from the HL gilts page on every `/gilts` request and daily via cron; `backend/gilts.json` is a cache of the last successful fetch (starts empty). Only conventional gilts are kept; if the feed returns nothing, the API returns 503 and keeps the last cache.
- Dirty price: Actual/Actual day count, semi-annual coupons.
- Yields use an internal XIRR solver on cashflows; net yield applies selected tax rate to coupons.

## Render Deployment
- `render.yaml` defines:
  - `gilts-backend` Node web service (root: `backend`, start: `node index.js`)
  - `gilts-frontend` static site (root: `frontend`, build: `npm install && npm run build`, publishes `dist`)
- Set environment variables in Render dashboard:
- Backend: `USERNAME`, `PASSWORD`, optional `PRICE_FEED_URL`, `HL_GILTS_URL`, `PORT`.
  - Frontend: `VITE_API_BASE` pointing to the backend URL (default placeholder provided).

## Notes
- Works offline with deterministic synthetic prices; live price feed optional via `PRICE_FEED_URL`.
- All endpoints are behind Basic Auth; health endpoint available at `/health`.
