import type { Config } from "@netlify/functions";

export default async () => {
  const configured = Boolean(Netlify.env.get("TELEGRAM_BOT_TOKEN") && Netlify.env.get("TELEGRAM_CHAT_ID"));
  return Response.json({
    service: "Global Market Radar",
    status: "ok",
    telegramConfigured: configured,
    schedule: "Every 15 minutes (UTC)",
    source: "GDELT DOC 2.1",
    checkedAt: new Date().toISOString()
  }, { status: 200 });
};

export const config: Config = { path: "/api/health", method: ["GET"] };
