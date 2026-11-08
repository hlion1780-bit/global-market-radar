# Global Market Radar

A free-first Telegram intelligence radar for market-moving global news.

## Included
- Six thematic GDELT searches: central banks/rates, inflation/labor, FX/sovereign risk, commodities/geopolitics, equities/AI/credit and digital assets.
- P1–P3 prioritization with asset/event classification.
- Telegram alerts with source URL, publisher, GDELT timestamp, scan timestamp and an explicitly labelled analytical read-through.
- Persistent URL deduplication using Netlify Blobs.
- 15-minute UTC scheduled scans.
- `/api/health` status endpoint and a static landing page.

## Deploy to Netlify
1. In Netlify, open **global-market-radar-pdle**.
2. Go to **Project configuration → Build & deploy → Continuous deployment → Link repository** and select `hlion1780-bit/global-market-radar`, branch `main`.
3. Set two environment variables in **Project configuration → Environment variables**. Make sure their scope includes **Functions**:
   - `TELEGRAM_BOT_TOKEN`: token from BotFather.
   - `TELEGRAM_CHAT_ID`: your private chat ID or target channel ID.
4. Trigger a production deploy. The schedule starts only after a successful published deploy.
5. Open `/api/health` to check configuration, then use Netlify's scheduled-function **Run now** action for a first test.

Never put a real token in GitHub, source code, screenshots or chat. Rotate the token through BotFather if it is ever exposed.

## Local development
- Install Node.js 20+.
- Run `npm install`.
- Copy `.env.example` to `.env` and fill credentials locally (never commit it).
- Install Netlify CLI and run `netlify dev`.
- Scheduled functions do not run on a local cron schedule; invoke `market-radar` manually for a smoke test.

## Data quality and limitations
GDELT is a broad public news index, not a real-time institutional wire. Indexing latency and publisher coverage vary. Priority is a headline-based heuristic, not an event-surprise model. The market read-through is analysis, not observed price action or a trade signal. Confirm important events against primary sources and cross-asset market data.

## Environment variables
See `.env.example`. Both secrets are required for Telegram delivery.
