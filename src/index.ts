import { Hono } from "hono";

interface Bindings {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
}

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

interface MapLocation {
  lat?: number;
  lng?: number;
  name?: string;
  address?: string;
}

type MapSource = "google" | "apple";

interface DetectedMapUrl {
  source: MapSource;
  url: string;
}

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => c.text("OK"));

app.post("/webhook", async (c) => {
  const secret = c.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = c.req.header("X-Telegram-Bot-Api-Secret-Token");
    if (headerSecret !== secret) {
      return c.text("Unauthorized", 401);
    }
  }

  const update = await c.req.json<TelegramUpdate>();
  const message = update.message;
  if (!message?.text) {
    return c.json({ ok: true });
  }

  const chatId = message.chat.id;
  const mapLink = extractMapUrl(message.text);
  if (!mapLink) {
    return c.json({ ok: true });
  }

  try {
    const converted = await convertMapUrl(mapLink);
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, chatId, converted);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, chatId, `Failed to convert: ${errorMsg}`);
  }

  return c.json({ ok: true });
});

const URL_CHARS = String.raw`[A-Za-z0-9_\-~:/?#[\]@!$&'()*+,;=.%]`;

const MAP_PATTERNS: { source: MapSource; pattern: RegExp }[] = [
  { source: "google", pattern: new RegExp(`https?://maps\\.app\\.goo\\.gl/${URL_CHARS}+`) },
  { source: "google", pattern: new RegExp(`https?://goo\\.gl/maps/${URL_CHARS}+`) },
  { source: "google", pattern: new RegExp(`https?://(?:www\\.)?google\\.\\w+/maps/${URL_CHARS}+`) },
  { source: "apple", pattern: new RegExp(`https?://maps\\.apple/${URL_CHARS}+`) },
  { source: "apple", pattern: new RegExp(`https?://maps\\.apple\\.com/${URL_CHARS}+`) },
];

function extractMapUrl(text: string): DetectedMapUrl | null {
  for (const { source, pattern } of MAP_PATTERNS) {
    const match = text.match(pattern);
    if (match) return { source, url: match[0] };
  }
  return null;
}

async function resolveUrl(shortUrl: string): Promise<string> {
  let url = shortUrl;
  for (let i = 0; i < 10; i++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const location = response.headers.get("location");
    if (!location) return response.url || url;
    url = location.startsWith("http") ? location : new URL(location, url).href;
  }
  return url;
}

function parseCoordString(s: string): { lat: number; lng: number } | null {
  const match = s.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
}

function extractCoordsFromGoogleUrl(url: string): { lat: number; lng: number } | null {
  // !3d<lat>!4d<lng> in URL path/data
  const dMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (dMatch) return { lat: parseFloat(dMatch[1]), lng: parseFloat(dMatch[2]) };

  // @lat,lng in URL path
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

  // q=lat,lng as coordinates
  try {
    const q = new URL(url).searchParams.get("q");
    if (q) return parseCoordString(q);
  } catch {
    // ignore malformed URL
  }

  return null;
}

function parseGoogleMaps(url: string): MapLocation | null {
  const coords = extractCoordsFromGoogleUrl(url);

  const placeMatch = url.match(/\/place\/([^/@]+)/);
  const nameFromPath = placeMatch ? decodeURIComponent(placeMatch[1].replace(/\+/g, " ")) : undefined;

  if (coords) {
    return { ...coords, name: nameFromPath };
  }

  // Fallback: parse q as "Name, Address" text
  try {
    const q = new URL(url).searchParams.get("q");
    if (q) {
      const text = decodeURIComponent(q.replace(/\+/g, " "));
      const commaIndex = text.indexOf(",");
      if (commaIndex !== -1) {
        return {
          name: text.substring(0, commaIndex).trim(),
          address: text.substring(commaIndex + 1).trim(),
        };
      }
      return { name: text };
    }
  } catch {
    // ignore malformed URL
  }

  if (nameFromPath) return { name: nameFromPath };
  return null;
}

function extractCoordsFromAppleParams(params: URLSearchParams): { lat: number; lng: number } | null {
  for (const key of ["coordinate", "ll", "sll"]) {
    const value = params.get(key);
    if (value) {
      const coords = parseCoordString(value);
      if (coords) return coords;
    }
  }
  return null;
}

function parseAppleMaps(url: string): MapLocation | null {
  try {
    const params = new URL(url).searchParams;
    const coords = extractCoordsFromAppleParams(params);
    const name = params.get("name") ?? params.get("q") ?? undefined;
    const address = params.get("address") ?? undefined;

    if (coords) return { ...coords, name, address };
    if (name || address) return { name, address };
  } catch {
    // ignore malformed URL
  }
  return null;
}

function buildAppleMapsUrl(loc: MapLocation): string {
  const params = new URLSearchParams();
  if (loc.lat !== undefined && loc.lng !== undefined) {
    params.set("ll", `${loc.lat},${loc.lng}`);
  }
  if (loc.name) params.set("q", loc.name);
  if (loc.address) params.set("address", loc.address);
  return `https://maps.apple.com/?${params.toString()}`;
}

function buildGoogleQuery(loc: MapLocation): string {
  if (loc.name && loc.address) {
    // Avoid "Ginza, Ginza, Chuo..." when address already starts with name
    if (loc.address.toLowerCase().startsWith(loc.name.toLowerCase())) return loc.address;
    return `${loc.name}, ${loc.address}`;
  }
  return loc.name ?? loc.address ?? `${loc.lat},${loc.lng}`;
}

function buildGoogleMapsUrl(loc: MapLocation): string {
  const params = new URLSearchParams();
  params.set("api", "1");
  params.set("query", buildGoogleQuery(loc));
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

async function convertMapUrl(mapLink: DetectedMapUrl): Promise<string> {
  const fullUrl = await resolveUrl(mapLink.url);
  const loc = mapLink.source === "google" ? parseGoogleMaps(fullUrl) : parseAppleMaps(fullUrl);

  if (!loc) {
    throw new Error("Could not extract location from the URL");
  }

  return mapLink.source === "google" ? buildAppleMapsUrl(loc) : buildGoogleMapsUrl(loc);
}

async function sendTelegramMessage(token: string, chatId: number, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Telegram API error ${resp.status}: ${body}`);
  }
}

export default app;
