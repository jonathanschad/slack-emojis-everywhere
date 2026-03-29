import { storage } from "#imports";
import type { EmojiMap, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const keys = {
  token: storage.defineItem<string | null>("local:slackToken", {
    fallback: null,
  }),
  teamName: storage.defineItem<string | null>("local:teamName", {
    fallback: null,
  }),
  emojis: storage.defineItem<EmojiMap>("local:emojis", {
    fallback: {},
  }),
  lastRefresh: storage.defineItem<number | null>("local:lastRefresh", {
    fallback: null,
  }),
  settings: storage.defineItem<Settings>("local:settings", {
    fallback: DEFAULT_SETTINGS,
  }),
};

export async function getToken() {
  return keys.token.getValue();
}

export async function setToken(token: string, teamName: string | null) {
  await Promise.all([
    keys.token.setValue(token),
    keys.teamName.setValue(teamName),
  ]);
}

export async function getEmojis(): Promise<EmojiMap> {
  return keys.emojis.getValue();
}

export async function setEmojis(emojis: EmojiMap) {
  await Promise.all([
    keys.emojis.setValue(emojis),
    keys.lastRefresh.setValue(Date.now()),
  ]);
}

export async function getSettings(): Promise<Settings> {
  return keys.settings.getValue();
}

export async function updateSettings(partial: Partial<Settings>) {
  const current = await getSettings();
  await keys.settings.setValue({ ...current, ...partial });
}

export async function getLastRefresh() {
  return keys.lastRefresh.getValue();
}

export async function getTeamName() {
  return keys.teamName.getValue();
}

export async function clearAll() {
  await Promise.all([
    keys.token.setValue(null),
    keys.teamName.setValue(null),
    keys.emojis.setValue({}),
    keys.lastRefresh.setValue(null),
  ]);
}

export function watchEmojis(
  callback: (newVal: EmojiMap, oldVal: EmojiMap) => void,
) {
  return keys.emojis.watch(callback);
}

export function watchSettings(
  callback: (newVal: Settings, oldVal: Settings) => void,
) {
  return keys.settings.watch(callback);
}
