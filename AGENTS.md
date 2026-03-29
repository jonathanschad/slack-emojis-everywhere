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
                         │ oauth.v2.access              │
                         │ emoji.list                   │
                         ▼                              │
                    ┌──────────┐                        │
                    │ Slack API│                        │
                    └──────────┘                        │
```

### Key Components

- **Extension Popup** (`entrypoints/popup/`): React UI with a
  "Sign in with Slack" button and a dashboard (emoji grid, sync status).
- **Background Script** (`entrypoints/background.ts`): Service worker
  that handles OAuth directly with Slack, fetches emojis from `emoji.list`,
  manages auto-refresh alarms.
- **Content Script** (`entrypoints/content.ts`): Runs on all pages.
  Uses TreeWalker to find `:emoji_name:` text nodes and replaces them with `<img>`
  tags. MutationObserver catches dynamically added content.
- **Lib** (`lib/`): Shared modules -- Slack API client, typed
  storage wrapper, emoji replacer logic.

### Authentication Flow

The extension handles OAuth directly with Slack (no proxy server). Slack app
credentials are embedded at build time via `VITE_SLACK_CLIENT_ID` and
`VITE_SLACK_CLIENT_SECRET` env vars. This is acceptable because the extension
is distributed internally within the org.

1. Extension builds the Slack OAuth URL with its browser-specific redirect URI
2. Extension opens the URL via `browser.identity.launchWebAuthFlow()`
3. User authorizes on Slack; Slack redirects back with an authorization code
4. `launchWebAuthFlow` intercepts the redirect and returns the response URL
5. Extension extracts the code and exchanges it for a user token by calling
   `oauth.v2.access` directly from the background service worker
6. Extension stores the token and fetches emojis

### Redirect URIs (registered in Slack app config)

- **Chrome**: `https://fkhaekiaendnoocnebpklhdpplpjfkkf.chromiumapp.org/`
- **Firefox**: `https://slack-emoji-everywhere@extension.extensions.allizom.org/`

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

## Project Structure

```
entrypoints/
  background.ts          -- Service worker: OAuth, alarms, emoji fetch
  content.ts             -- Content script: DOM emoji replacement
  popup/
    index.html           -- Popup HTML shell
    main.tsx             -- React mount
    App.tsx              -- Root component (routes sign-in vs dashboard)
    style.css            -- Tailwind entry
    components/
      SignIn.tsx          -- "Sign in with Slack" button
      Dashboard.tsx      -- Connected state: status bar, refresh, disconnect
      EmojiGrid.tsx      -- Searchable emoji preview grid
lib/
  types.ts               -- Shared TypeScript types and message definitions
  storage.ts             -- Typed wrapper around WXT storage API
  slack.ts               -- Slack OAuth + emoji.list API client
  emoji-replacer.ts      -- TreeWalker + MutationObserver DOM replacement
assets/
  icon.svg               -- Extension icon
wxt.config.ts            -- WXT configuration
.env.example             -- VITE_SLACK_CLIENT_ID + VITE_SLACK_CLIENT_SECRET template
```

## Development

```bash
pnpm install
cp .env.example .env  # fill in SLACK_CLIENT_ID + SLACK_CLIENT_SECRET
pnpm dev              # Chrome dev mode with HMR
pnpm dev:firefox      # Firefox dev mode
```

## Building for Distribution

```bash
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
- Slack credentials are baked in at build time; the extension is for internal
  org distribution only.

## Manifest Permissions

- `identity` -- for `launchWebAuthFlow` OAuth popup
- `alarms` -- for periodic emoji refresh
- `storage` -- for persisting token, emojis, settings
- `host_permissions`: `https://slack.com/api/*` -- for Slack API calls
- `host_permissions`: `https://*.slack-edge.com/*` -- for loading emoji images
