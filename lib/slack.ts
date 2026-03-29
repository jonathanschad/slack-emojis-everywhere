import type { EmojiMap } from "./types";

const SLACK_CLIENT_ID = import.meta.env.VITE_SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = import.meta.env.VITE_SLACK_CLIENT_SECRET;
const SLACK_API = "https://slack.com/api";

export function buildOAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    user_scope: "emoji:read",
    redirect_uri: redirectUri,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; teamName?: string }> {
  const res = await fetch(`${SLACK_API}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error(`Slack returned ${res.status}`);
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
