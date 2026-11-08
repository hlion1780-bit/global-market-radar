import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

type Article = {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  language?: string;
  sourcecountry?: string;
};

type Theme = { name: string; query: string };
const THEMES: Theme[] = [
  { name: "CENTRAL BANKS & RATES", query: '("Federal Reserve" OR Fed OR FOMC OR ECB OR "Bank of Japan" OR BOJ OR BOE OR "central bank" OR "interest rate")' },
  { name: "INFLATION & LABOR", query: '(CPI OR inflation OR PCE OR payrolls OR NFP OR unemployment OR wages OR "jobless claims")' },
  { name: "FX & SOVEREIGN RISK", query: '("US dollar" OR DXY OR euro OR yen OR sterling OR "bond yields" OR Treasury OR sovereign OR debt)' },
  { name: "COMMODITIES & GEOPOLITICS", query: '(oil OR crude OR OPEC OR gas OR gold OR tariff OR sanctions OR war OR conflict OR shipping)' },
  { name: "EQUITIES, AI & CREDIT", query: '(earnings OR "artificial intelligence" OR semiconductor OR Nvidia OR Apple OR "credit spread" OR default OR Nasdaq)' },
  { name: "DIGITAL ASSETS", query: '(Bitcoin OR Ethereum OR crypto OR cryptocurrency OR stablecoin OR "digital assets")' }
];

const RULES: Array<{ re: RegExp; priority: number; assets: string[]; event: string }> = [
  { re: /emergency rate|emergency meeting|unscheduled meeting|intervention|capital control|bank failure|sovereign default|ceasefire collapse|missile strike|invasion/i, priority: 1, assets: ["FX", "RATES", "RISK"], event: "SYSTEMIC / GEOPOLITICAL" },
  { re: /federal reserve|fomc|ecb|bank of japan|bank of england|rate decision|interest rate decision|inflation|consumer price index|payrolls|nonfarm|unemployment rate|opec|sanction|tariff|earnings|guidance|default|credit downgrade/i, priority: 2, assets: ["RATES", "FX", "EQUITIES"], event: "MACRO / POLICY" },
  { re: /treasury yield|bond yield|dollar|euro|yen|sterling|crude oil|brent|wti|gold|semiconductor|artificial intelligence|bitcoin|ethereum|geopolitical|trade balance|current account/i, priority: 3, assets: ["FX", "RATES", "COMMODITIES", "EQUITIES"], event: "CROSS-ASSET" }
];

function classify(title: string, theme: string) {
  const rule = RULES.find(r => r.re.test(title));
  if (rule) return rule;
  if (/DIGITAL ASSETS/.test(theme)) return { priority: 3, assets: ["BTC", "ETH", "CRYPTO"], event: "DIGITAL ASSETS" };
  if (/COMMODITIES/.test(theme)) return { priority: 3, assets: ["OIL", "GOLD", "ENERGY"], event: "COMMODITIES / GEOPOLITICS" };
  return { priority: 4, assets: ["MACRO"], event: theme };
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function impactRead(title: string, assets: string[]) {
  const t = title.toLowerCase();
  if (/rate hike|raises rates|hawkish|higher for longer|hotter.*inflation|accelerat.*inflation|strong.*payroll|sanction|supply disruption/.test(t))
    return "Potentially supportive for yields or the affected supply-risk premium; direction depends on what was priced in.";
  if (/rate cut|cuts rates|dovish|cooling inflation|slower.*inflation|weak.*payroll|recession|ceasefire|disinflation/.test(t))
    return "Could ease rate or risk premia, but confirmation from yields, FX and equity breadth is required.";
  if (/earnings|guidance|revenue|artificial intelligence|semiconductor/.test(t))
    return "Potential single-name or sector repricing; check guidance, valuation and index concentration before extrapolating.";
  return `Potential catalyst for ${assets.join(", ")}; direction is not established by the headline alone. Watch confirmation in price, yields and FX.`;
}

async function fetchTheme(theme: Theme): Promise<{ theme: string; articles: Article[] }> {
  const params = new URLSearchParams({
    query: theme.query,
    mode: "ArtList",
    format: "json",
    maxrecords: "40",
    sort: "DateDesc",
    timespan: "6h"
  });
  const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
    headers: { "User-Agent": "GlobalMarketRadar/1.0 (market news digest)" },
    signal: AbortSignal.timeout(12000)
  });
  if (!res.ok) throw new Error(`GDELT ${res.status} for ${theme.name}`);
  const data = await res.json() as { articles?: Article[] };
  return { theme: theme.name, articles: data.articles ?? [] };
}

async function sendTelegram(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    }),
    signal: AbortSignal.timeout(10000)
  });
  const body = await res.json() as { ok?: boolean; description?: string };
  if (!res.ok || !body.ok) throw new Error(body.description ?? `Telegram HTTP ${res.status}`);
}

export default async () => {
  const token = Netlify.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Netlify.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID (Functions scope required).");
    return new Response("Missing Telegram configuration", { status: 500 });
  }

  const store = getStore("market-radar-dedup");
  const results = await Promise.allSettled(THEMES.map(fetchTheme));
  const errors = results.filter(r => r.status === "rejected").length;
  const seen = new Set<string>();
  const candidates: Array<{ article: Article; theme: string; priority: number; assets: string[]; event: string }> = [];

  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.error("Feed query failed:", result.reason);
      continue;
    }
    for (const article of result.value.articles) {
      const title = (article.title ?? "").trim();
      const url = article.url ?? "";
      if (!title || !url || seen.has(url)) continue;
      seen.add(url);
      const c = classify(title, result.value.theme);
      if (c.priority > 3) continue;
      candidates.push({ article, theme: result.value.theme, ...c });
    }
  }

  candidates.sort((a, b) => a.priority - b.priority);
  let sent = 0;
  let skipped = 0;
  const cap = 12;

  for (const item of candidates) {
    if (sent >= cap) break;
    const url = item.article.url!;
    const key = `story:${encodeURIComponent(url).slice(0, 540)}`;
    if (await store.get(key)) { skipped++; continue; }

    const title = item.article.title ?? "Untitled story";
    const domain = item.article.domain ?? "Source";
    const published = item.article.seendate ?? "Timestamp unavailable";
    const priority = `P${item.priority}`;
    const alert = [
      `<b>🌐 GLOBAL MARKET RADAR · ${priority}</b>`,
      `<b>${esc(item.event)}</b>  |  ${esc(item.assets.join(" · "))}`,
      "",
      `<b>${esc(title)}</b>`,
      `Source: ${esc(domain)} · GDELT indexed: ${esc(published)}`,
      "",
      `<b>Market read-through:</b> ${esc(impactRead(title, item.assets))}`,
      `<b>Classification:</b> Headline-based; independently verify the underlying release and market reaction.`,
      "",
      `<a href="${esc(url)}">Open source ↗</a>`,
      `<i>Radar scan: ${new Date().toISOString()}</i>`
    ].join("\n");

    await sendTelegram(token, chatId, alert);
    await store.set(key, new Date().toISOString(), { metadata: { priority, theme: item.theme } });
    sent++;
  }

  const summary = { sent, candidates: candidates.length, duplicates: skipped, feedErrors: errors, scannedAt: new Date().toISOString() };
  console.log("Market radar run:", summary);
  return Response.json(summary);
};

export const config: Config = { schedule: "*/15 * * * *" };
