# Global Market Radar

A free-first Telegram intelligence radar for market-moving global news.

## What it does
- Scans GDELT's global news index every 15 minutes.
- Filters stories across central banks, rates, inflation, labor, FX, sovereign risk, commodities, equities/AI, geopolitics, credit and digital assets.
- Scores each story P1–P4 using keyword impact and source context.
- Sends concise Telegram alerts with source links, timestamps, affected assets and a clearly-labelled analytical read-through.
- Deduplicates stories with Netlify Blobs.

## Stack
- Netlify Scheduled Function (UTC cron)
- GDELT DOC 2.1 (free public news index)
- Telegram Bot API
- Netlify Blobs for persistent deduplication

## Deploy
1. Connect this GitHub repository to the existing Netlify project.
2. Set the following **Functions-scoped** environment variables in Netlify:
   - `TELEGRAM_BOT_TOKEN` — bot token from BotFather
   - `TELEGRAM_CHAT_ID` — destination chat or channel ID
3. Deploy the `main` branch. The scheduled function runs every 15 minutes (UTC).
4. Test the function using Netlify's **Run now** action after the first published deploy.

No credentials belong in this repository. Never commit bot tokens.

## Important limitations
GDELT is a broad public news index, not a real-time institutional wire. Coverage and latency vary by publisher and event. The bot labels its market read-through as analysis, not verified price action or a trade signal. It does not fetch live quotes or imply that an asset has moved.

## Local smoke checks
The scheduled function expects Netlify's runtime and environment variables. TypeScript source is in `netlify/functions/`.
