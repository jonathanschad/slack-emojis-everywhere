# Slack Emoji Everywhere -- Browser Extension

## Overview

A cross-browser extension (Chrome + Firefox) that replaces `:custom_emoji_name:` text
patterns on any webpage with the actual custom emoji images from a user's Slack workspace.

Built with WXT, React, TypeScript, and Tailwind CSS. Distributed internally via GitHub.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│ Browser Extension                                      │
│                                                        │
│ ┌─────────────┐ ┌──────────────┐ ┌───────────────┐    │
│ │ Popup UI    │──│ Background   │──│ Content Script │  │
│ │ (React)     │ │ (Service     │ │ (DOM scanner)  │   │
│ │             │ │  Worker)     │ │                │   │
│ └─────────────┘ └──────┬───────┘ └───────┬───────┘   │
│                        │                 │            │
│               browser.storage.local      │            │
│               (token, emojis, settings)  │            │
└────────────────────────┬─────────────────┘            │
                         │                              │
                         │   │ emoji.list               │
                         ▼   ▼                          │
              ┌────────────────────┐                    │
              │ OAuth Proxy        │                    │
              │ (Cloudflare Worker)│                    │
              └────────┬───────────┘                    │
                       │ oauth.v2.access                │
                       │ (with client secret)           │
                       ▼                                │
                  ┌──────────┐                          │
                  │ Slack API│                          │
                  └──────────┘                          │
```

### Key Components

- **Extension Popup** (`extension/entrypoints/popup/`): React UI with a
  "Sign in with Slack" button and a dashboard (emoji grid, sync status).
- **Background Script** (`extension/entrypoints/background.ts`): Service worker
  that initiates OAuth (via the proxy), fetches emojis from `emoji.list`,
  manages auto-refresh alarms.
- **OAuth Proxy** (`oauth-proxy/`): Cloudflare Worker that holds the
  Slack client ID and secret. Provides `/authorize` (builds the OAuth URL)
  and `/token` (exchanges code for token). Validates redirect URIs against
  an allowlist and enforces request timestamps.
- **Content Script** (`extension/entrypoints/content.ts`): Runs on all pages.
  Uses TreeWalker to find `:emoji_name:` text nodes and replaces them with `<img>`
  tags. MutationObserver catches dynamically added content.
- **Lib** (`extension/lib/`): Shared modules -- Slack API client, typed
  storage wrapper, emoji replacer logic.

### Authentication Flow

The Slack client ID and secret never leave the server. The extension has
no Slack credentials -- it only knows the proxy URL.

1. Extension asks proxy for the OAuth URL: `GET /authorize?redirect_uri=...`
2. Proxy validates the redirect URI against its allowlist, builds the
   Slack authorize URL with its client ID, returns it
3. Extension opens the URL via `browser.identity.launchWebAuthFlow()`
4. User authorizes on Slack; Slack redirects back with an authorization code
5. `launchWebAuthFlow` intercepts the redirect and returns the response URL
6. Extension sends the code to the proxy: `POST /token { code, redirect_uri, timestamp }`
7. Proxy validates the redirect URI and timestamp (5-minute window),
   then calls `oauth.v2.access` with its client secret
8. Proxy returns the Slack response; extension stores the token and fetches emojis

### Redirect URIs (registered in Slack app config)

- **Chrome**: `https://fkhaekiaendnoocnebpklhdpplpjfkkf.chromiumapp.org/`
- **Firefox**: `https://a408093059fe87bf3db6b5b6a50ca40a0e77e627.extensions.allizom.org/`

The Chrome ID is pinned via the `key` field in the manifest.
The Firefox ID is pinned via `browser_specific_settings.gecko.id`.

## Tech Stack

| Tool | Purpose |
|-------------|---------------------------------------|
| WXT 0.20.x | Extension framework (Vite, cross-browser) |
| React 19 | Popup UI |
| TypeScript | Type safety throughout |
| Tailwind v4 | Styling |
| pnpm | Package manager |
| Cloudflare Workers | OAuth proxy (token exchange) |

## Project Structure

```
extension/                     -- Browser extension (WXT + React)
  entrypoints/
    background.ts              -- Service worker: OAuth, alarms, emoji fetch
    content.ts                 -- Content script: DOM emoji replacement
    popup/
      index.html               -- Popup HTML shell
      main.tsx                 -- React mount
      App.tsx                  -- Root component (routes sign-in vs dashboard)
      style.css                -- Tailwind entry
      components/
        SignIn.tsx              -- "Sign in with Slack" button
        Dashboard.tsx          -- Connected state: status bar, refresh, disconnect
        EmojiGrid.tsx          -- Searchable emoji preview grid
  lib/
    types.ts                   -- Shared TypeScript types and message definitions
    storage.ts                 -- Typed wrapper around WXT storage API
    slack.ts                   -- Slack OAuth + emoji.list API client
    emoji-replacer.ts          -- TreeWalker + MutationObserver DOM replacement
  assets/
    icon.svg                   -- Extension icon
  wxt.config.ts                -- WXT configuration
  .env.example                 -- Extension env template (just the proxy URL)
  package.json                 -- Extension dependencies

oauth-proxy/                   -- Cloudflare Worker (token exchange)
  src/index.ts                 -- /authorize + /token endpoints, redirect URI allowlist
  wrangler.toml                -- Worker config (allowed redirect URIs)
  .dev.vars.example            -- Secrets template for local dev
  package.json                 -- Worker dependencies
```

## Development

```bash
# OAuth proxy (Terminal 1)
cd oauth-proxy
pnpm install
cp .dev.vars.example .dev.vars  # fill in Slack client ID + secret
pnpm dev                        # runs on http://localhost:8787

# Extension (Terminal 2)
cd extension
pnpm install
cp .env.example .env            # set proxy URL (default: localhost:8787)
pnpm dev                        # Chrome dev mode with HMR
pnpm dev:firefox                # Firefox dev mode
```

## Building for Distribution

```bash
cd extension
pnpm build          # Production build for Chrome
pnpm build:firefox  # Production build for Firefox
pnpm zip            # Zip for Chrome
pnpm zip:firefox    # Zip for Firefox
```

## Conventions

- All browser APIs are accessed via WXT's auto-imported `browser` namespace
  (polyfilled for cross-browser compat).
- State is persisted in `browser.storage.local` using WXT's `storage.defineItem`
  for type-safe access.
- The content script uses `requestAnimationFrame` to debounce MutationObserver
  callbacks and avoid layout thrashing.
- Emojis auto-refresh every 30 minutes via `browser.alarms`.
- Alias emojis (`alias:other_name`) are resolved recursively with a depth limit.
- No Slack credentials are in the extension bundle. The only extension
  env var is the OAuth proxy URL.
- The proxy holds the Slack client ID and secret, and validates redirect
  URIs against a hardcoded allowlist.
- Token exchange requests include a timestamp; the proxy rejects anything
  older than 5 minutes.

## Manifest Permissions

- `identity` -- for `launchWebAuthFlow` OAuth popup
- `alarms` -- for periodic emoji refresh
- `storage` -- for persisting token, emojis, settings
- `host_permissions`: `https://slack.com/api/*` -- for Slack API calls
- `host_permissions`: `https://*.slack-edge.com/*` -- for loading emoji images
