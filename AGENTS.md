# Emoji Everywhere -- Browser Extension

## Overview

A cross-browser extension (Chrome + Firefox) that replaces `:custom_emoji_name:` text
patterns on any webpage with actual emoji images from multiple sources:
Slack workspaces and ZIP file imports.

Slack sign-in is optional -- the extension works with any combination of sources.

Built with WXT, React, TypeScript, and Tailwind CSS. Distributed internally via GitHub.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Browser Extension                                            │
│                                                              │
│ ┌─────────────────┐ ┌──────────────┐ ┌───────────────┐      │
│ │ Popup UI        │──│ Background   │──│ Content Script │    │
│ │ (React)         │ │ (Service     │ │ (DOM scanner)  │     │
│ │ Source manager  │ │  Worker)     │ │                │     │
│ └─────────────────┘ └──────┬───────┘ └───────┬───────┘      │
│                            │                 │               │
│        browser.storage.local                 │               │
│        (sources[], mergedEmojis, settings)   │               │
└────────────────────────────┬─────────────────┘               │
                             │                                 │
                    ┌────────┴────────┐                        │
                    │ Slack OAuth     │                        │
                    │ (PKCE, direct)  │                        │
                    │ No proxy needed │   ZIP sources:         │
                    └────────┬────────┘   imported locally     │
                             │            via file picker      │
                    ┌────────┴────────┐                        │
                    │ Slack API       │                        │
                    │ v2_user/auth +  │                        │
                    │ emoji.list      │                        │
                    └─────────────────┘
```

### Multi-Source Data Model

Emojis come from multiple independent sources. Each source has its own ID,
name, emoji map, and type-specific metadata:

- **Slack sources** (`SlackSource`): OAuth token, team name, auto-refresh,
  error tracking. Multiple Slack workspaces can be connected simultaneously.
- **ZIP sources** (`ZipSource`): Imported locally. File names (minus extension)
  become emoji names. Images are stored as data URLs.

All source emojis are merged into a flat `mergedEmojis` map for the content
script. The popup UI displays emojis grouped by source.

### Key Components

- **Popup** (`entrypoints/popup/`): React UI with a source management hub.
  Shows all connected sources with per-source emoji grids. "Add source"
  section offers Slack sign-in and ZIP import.
- **Background Script** (`entrypoints/background.ts`): Service worker that
  handles PKCE OAuth for Slack workspaces, ZIP imports, per-source refresh,
  source removal, and auto-refresh alarms for all Slack sources.
- **Content Script** (`entrypoints/content.ts`): Runs on all pages. Uses the
  merged emoji map from all sources. TreeWalker finds `:emoji_name:` text
  nodes and replaces them with `<img>` tags. MutationObserver catches
  dynamically added content.
- **Lib** (`lib/`): Shared modules -- Slack API client with PKCE, typed
  storage wrapper, emoji replacer logic, autocomplete, search, image cache.

### Authentication Flow (PKCE)

The extension authenticates directly with Slack using PKCE (Proof Key for
Code Exchange). No proxy or client secret is needed.

1. Extension generates a random `code_verifier` and derives a
   `code_challenge` (SHA-256, base64url-encoded)
2. Extension builds the Slack authorize URL:
   `https://slack.com/oauth/v2_user/authorize?client_id=...&scope=emoji:read&code_challenge=...&code_challenge_method=S256&redirect_uri=...`
3. Extension opens the URL via `browser.identity.launchWebAuthFlow()`
4. User authorizes on Slack; Slack redirects back with an authorization code
5. `launchWebAuthFlow` intercepts the redirect and returns the response URL
6. Extension calls `oauth.v2.user.access` directly with the `code` and
   `code_verifier` (no client secret)
7. Slack verifies the code_verifier matches the original code_challenge
8. Extension stores the source and fetches emojis

If the same Slack team is re-authenticated, the existing source is updated
rather than creating a duplicate.

### Redirect URIs (registered in Slack app config)

- **Chrome**: `https://fkhaekiaendnoocnebpklhdpplpjfkkf.chromiumapp.org/`
- **Firefox**: `https://a408093059fe87bf3db6b5b6a50ca40a0e77e627.extensions.allizom.org/`

The Chrome ID is pinned via the `key` field in the manifest.
The Firefox ID is pinned via `browser_specific_settings.gecko.id`.

## Tech Stack

| Tool        | Purpose                                    |
|-------------|--------------------------------------------|
| WXT 0.20.x  | Extension framework (Vite, cross-browser)  |
| React 19    | Popup UI                                   |
| TypeScript  | Type safety throughout                     |
| Tailwind v4 | Styling                                    |
| pnpm        | Package manager                            |
| @zip.js/zip.js | ZIP file reading for emoji imports      |

## Project Structure

```
entrypoints/
  background.ts             -- Service worker: PKCE OAuth, multi-source management, alarms
  content.ts                -- Content script: DOM emoji replacement (merged map)
  popup/
    index.html              -- Popup HTML shell
    main.tsx                -- React mount
    App.tsx                 -- Root component: source management hub
    style.css               -- Tailwind entry
    components/
      SourceList.tsx        -- Expandable cards per source (refresh, remove, emoji grid)
      AddSource.tsx         -- "Add source" section: Slack sign-in + ZIP import
      EmojiGrid.tsx         -- Searchable emoji grid for a single source
      ZipImport.tsx         -- ZIP file import popup
lib/
  types.ts                  -- EmojiSource union, message types, settings
  storage.ts                -- Multi-source storage (sources[], mergedEmojis)
  slack.ts                  -- PKCE helpers + Slack API client (no proxy)
  emoji-replacer.ts         -- TreeWalker + MutationObserver DOM replacement
  emoji-autocomplete.ts     -- Inline autocomplete for :emoji: in text fields
  emoji-search.ts           -- Fuzzy emoji search with scoring
  emoji-cache.ts            -- Cache API image pre-caching
assets/
  icon.svg                  -- Extension icon
wxt.config.ts               -- WXT configuration
.env.example                -- Env template (client ID + dev server port)
package.json                -- Dependencies
```

## Development

```bash
pnpm install
cp .env.example .env        # fill in your Slack app's client ID
pnpm dev                    # Chrome dev mode with HMR
pnpm dev:firefox            # Firefox dev mode
```

## Building for Distribution

```bash
pnpm build                  # Production build for Chrome
pnpm build:firefox          # Production build for Firefox
pnpm zip                    # Zip for Chrome
pnpm zip:firefox            # Zip for Firefox
```

## Conventions

- All browser APIs are accessed via WXT's auto-imported `browser` namespace
  (polyfilled for cross-browser compat).
- Emoji sources are stored as an array in `browser.storage.local` using
  WXT's `storage.defineItem` for type-safe access. A merged flat map is
  kept in sync for fast content script access.
- The content script uses `requestAnimationFrame` to debounce MutationObserver
  callbacks and avoid layout thrashing.
- All Slack sources auto-refresh every 30 minutes via `browser.alarms`.
- Alias emojis (`alias:other_name`) are resolved recursively with a depth limit.
- OAuth uses PKCE (Proof Key for Code Exchange) so no client secret is needed
  and no server-side proxy is required. The Slack app must have PKCE enabled.
- The only env var is the Slack client ID, which is safe to include in the
  extension bundle (public clients are designed to expose the client ID).
- ZIP imports read image files from the archive, convert them to data URLs,
  and use the filename (without extension) as the emoji name.
- Re-authenticating an existing Slack team updates the source in-place
  rather than creating a duplicate.

## Manifest Permissions

- `identity` -- for `launchWebAuthFlow` OAuth popup
- `alarms` -- for periodic emoji refresh
- `storage` -- for persisting sources, emojis, settings
- `host_permissions`: `https://slack.com/api/*` -- for Slack API calls
- `host_permissions`: `https://*.slack-edge.com/*` -- for loading emoji images
