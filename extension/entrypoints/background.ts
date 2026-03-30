import {
  getToken,
  setToken,
  getEmojis,
  setEmojis,
  getLastRefresh,
  getTeamName,
  getSettings,
  clearAll,
} from "@/lib/storage";
import { getAuthorizeUrl, exchangeCodeForToken, fetchEmojis } from "@/lib/slack";
import { preCacheImages, clearImageCache } from "@/lib/emoji-cache";
import type { ExtensionStatus } from "@/lib/types";

const ALARM_NAME = "refresh-emojis";

async function startOAuthFlow(): Promise<{ success: boolean; error?: string }> {
  try {
    const redirectUri = browser.identity.getRedirectURL();
    const authUrl = await getAuthorizeUrl(redirectUri);

    const responseUrl = await browser.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    const url = new URL(responseUrl);
    const error = url.searchParams.get("error");

    if (error) {
      return { success: false, error: `Slack denied access: ${error}` };
    }

    const code = url.searchParams.get("code");
    if (!code) {
      return { success: false, error: "No authorization code received" };
    }

    const { accessToken, teamName } = await exchangeCodeForToken(
      code,
      redirectUri,
    );

    await setToken(accessToken, teamName);
    await refreshEmojis();

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

async function refreshEmojis(): Promise<void> {
  const token = await getToken();
  if (!token) return;

  const emojis = await fetchEmojis(token);
  await setEmojis(emojis);

  preCacheImages(emojis).catch(() => {});
}

async function getStatus(): Promise<ExtensionStatus> {
  const [token, teamName, emojis, lastRefresh] = await Promise.all([
    getToken(),
    getTeamName(),
    getEmojis(),
    getLastRefresh(),
  ]);

  return {
    authenticated: token !== null,
    teamName,
    emojiCount: Object.keys(emojis).length,
    lastRefresh,
    error: null,
  };
}

async function setupAlarm() {
  const settings = await getSettings();
  await browser.alarms.clear(ALARM_NAME);
  await browser.alarms.create(ALARM_NAME, {
    periodInMinutes: settings.refreshInterval,
  });
}

export default defineBackground(() => {
  console.log("Redirect URL:", browser.identity.getRedirectURL());

  browser.runtime.onInstalled.addListener(async () => {
    const token = await getToken();
    if (token) {
      try {
        await refreshEmojis();
      } catch {
        // token may be expired, user can re-authenticate
      }
    }
    await setupAlarm();
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;

    try {
      await refreshEmojis();
    } catch {
      // silent fail on auto-refresh, user can manually retry
    }
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message?.type) return false;

    switch (message.type) {
      case "START_OAUTH":
        startOAuthFlow().then((result) => {
          sendResponse({ type: "OAUTH_COMPLETE", ...result });
        });
        return true;

      case "FETCH_EMOJIS":
        refreshEmojis()
          .then(() => sendResponse({ success: true }))
          .catch((err) =>
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
            }),
          );
        return true;

      case "GET_STATUS":
        getStatus().then((status) => {
          sendResponse({ type: "STATUS_RESPONSE", status });
        });
        return true;

      case "DISCONNECT":
        Promise.all([clearAll(), clearImageCache()]).then(() => {
          browser.alarms.clear(ALARM_NAME);
          sendResponse({ success: true });
        });
        return true;
    }

    return false;
  });
});
