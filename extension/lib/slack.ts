import type { EmojiMap } from "./types";

const OAUTH_PROXY_URL = import.meta.env.VITE_OAUTH_PROXY_URL;
const SLACK_API = "https://slack.com/api";

export async function getAuthorizeUrl(redirectUri: string): Promise<string> {
  const params = new URLSearchParams({ redirect_uri: redirectUri });
  const res = await fetch(`${OAUTH_PROXY_URL}/authorize?${params}`);

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      `OAuth proxy error: ${err?.error ?? `HTTP ${res.status}`}`,
    );
  }

  const data = (await res.json()) as { ok: boolean; authorize_url?: string; error?: string };
  if (!data.ok || !data.authorize_url) {
    throw new Error(`Failed to get authorize URL: ${data.error ?? "unknown"}`);
  }

  return data.authorize_url;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; teamName?: string }> {
  const res = await fetch(`${OAUTH_PROXY_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      redirect_uri: redirectUri,
      timestamp: Date.now(),
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      `OAuth proxy error: ${err?.error ?? `HTTP ${res.status}`}`,
    );
  }

  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    authed_user?: { access_token: string };
    team?: { id: string; name: string };
  };

  if (!data.ok || !data.authed_user?.access_token) {
    throw new Error(`Slack OAuth failed: ${data.error ?? "unknown"}`);
  }

  return {
    accessToken: data.authed_user.access_token,
    teamName: data.team?.name,
  };
}

export async function fetchEmojis(token: string): Promise<EmojiMap> {
  const allEmojis: EmojiMap = {};
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = { token };
    if (cursor) params.cursor = cursor;

    const res = await fetch(`${SLACK_API}/emoji.list`, {
      method: "POST",
      body: new URLSearchParams(params),
    });

    if (!res.ok) {
      throw new Error(`Slack API request failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      ok: boolean;
      emoji?: Record<string, string>;
      error?: string;
      response_metadata?: { next_cursor?: string };
    };

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    Object.assign(allEmojis, data.emoji ?? {});
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return allEmojis;
}

export function resolveEmoji(
  name: string,
  emojis: EmojiMap,
  maxDepth = 5,
): string | null {
  let current = emojis[name];
  let depth = 0;

  while (current?.startsWith("alias:") && depth < maxDepth) {
    const aliasName = current.slice(6);
    current = emojis[aliasName];
    depth++;
  }

  if (!current || current.startsWith("alias:")) return null;
  return current;
}
