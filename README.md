# MapBridge Bot

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-26A5E4?logo=telegram&logoColor=white)](https://core.telegram.org/bots)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Telegram bot that instantly converts map links between Google Maps and Apple Maps.

<p align="center">
  <a href="https://t.me/mapbridge_bot">
    <img src="assets/t_me-mapbridge_bot.png" alt="@mapbridge_bot" width="300">
  </a>
</p>

## Usage

Send any Google Maps or Apple Maps link to the bot, and it will reply with the equivalent link for the other platform.

| You send | Bot replies |
| - | - |
| Google Maps link | Apple Maps link |
| Apple Maps link | Google Maps link |

## Supported Links

### Google Maps

- `https://maps.app.goo.gl/...` (short link)
- `https://goo.gl/maps/...` (legacy short link)
- `https://www.google.com/maps/...` (full URL)

### Apple Maps

- `https://maps.apple/p/...` (short link)
- `https://maps.apple.com/place?...`
- `https://maps.apple.com/?ll=...`

## How It Works

The bot extracts location data (coordinates, place name, address) from the source link and builds an equivalent link for the target platform. Short links are resolved by following redirects to obtain the full URL with location details.

## Self-Hosting

See [DEPLOY.md](DEPLOY.md) for self-hosting instructions.

## License

MIT
