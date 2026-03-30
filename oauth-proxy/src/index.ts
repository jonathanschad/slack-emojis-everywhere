interface Env {
  SLACK_CLIENT_ID: string;
  SLACK_CLIENT_SECRET: string;
  ALLOWED_REDIRECT_URIS: string;
  TOKEN_RATE_LIMITER: RateLimit;
}

interface TokenRequest {
  code: string;
  redirect_uri: string;
  timestamp: number;
}

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  authed_user?: { access_token: string };
  team?: { id: string; name: string };
}

const MAX_REQUEST_AGE_MS = 5 * 60 * 1000;
const SLACK_API = "https://slack.com/api";
const SLACK_CODE_PATTERN = /^[a-zA-Z0-9._-]{20,200}$/;

function getAllowedUris(env: Env): string[] {
  return env.ALLOWED_REDIRECT_URIS.split(",").map((s) => s.trim());
}

function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function handleAuthorize(request: Request, env: Env): Response {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri");

  if (!redirectUri) {
    return jsonError("missing_redirect_uri", 400);
  }

  if (!getAllowedUris(env).includes(redirectUri)) {
    return jsonError("invalid_redirect_uri", 403);
  }

  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    user_scope: "emoji:read",
    redirect_uri: redirectUri,
  });

  return Response.json({
    ok: true,
    authorize_url: `https://slack.com/oauth/v2/authorize?${params}`,
  });
}

async function handleToken(request: Request, env: Env): Promise<Response> {
  const { success } = await env.TOKEN_RATE_LIMITER.limit({
    key: request.headers.get("CF-Connecting-IP") ?? "unknown",
  });
  if (!success) {
    return jsonError("rate_limit_exceeded", 429);
  }

  let payload: TokenRequest;
  try {
    payload = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const { code, redirect_uri, timestamp } = payload;

  if (!code || !redirect_uri || !timestamp) {
    return jsonError("missing_fields", 400);
  }

  if (!SLACK_CODE_PATTERN.test(code)) {
    return jsonError("invalid_code_format", 400);
  }

  const age = Math.abs(Date.now() - timestamp);
  if (age > MAX_REQUEST_AGE_MS) {
    return jsonError("request_expired", 403);
  }

  if (!getAllowedUris(env).includes(redirect_uri)) {
    return jsonError("invalid_redirect_uri", 403);
  }

  const slackRes = await fetch(`${SLACK_API}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri,
    }),
  });

  const data = (await slackRes.json()) as SlackOAuthResponse;

  if (!data.ok || !data.authed_user?.access_token) {
    return jsonError(data.error ?? "slack_oauth_failed", 502);
  }

  return Response.json({
    ok: true,
    authed_user: { access_token: data.authed_user.access_token },
    team: data.team ? { name: data.team.name } : undefined,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    const url = new URL(request.url);

    if (url.pathname === "/authorize" && request.method === "GET") {
      return handleAuthorize(request, env);
    }

    if (url.pathname === "/token" && request.method === "POST") {
      return handleToken(request, env);
    }

    return jsonError("not_found", 404);
  },
} satisfies ExportedHandler<Env>;
