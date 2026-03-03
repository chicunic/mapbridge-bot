# Deployment Guide

## Prerequisites

- [Bun](https://bun.sh/)
- [Cloudflare](https://www.cloudflare.com/) account
- Telegram bot token from [@BotFather](https://t.me/BotFather)

## Steps

### 1. Install dependencies

```bash
bun install
```

### 2. Configure secrets

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

### 3. Deploy

```bash
bun run deploy
```

### 4. Register Telegram webhook

Replace `<TOKEN>`, `<WORKER_URL>`, `<SECRET>` with your values:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>/webhook&secret_token=<SECRET>"
```

### 5. Verify

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## Development

```bash
bun run dev       # Local dev server
bun run check     # Lint (Biome) + type check (tsc)
bun run fix       # Auto-fix lint issues
```
