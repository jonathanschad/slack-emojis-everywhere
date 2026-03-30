import { storage } from "#imports";
import type { EmojiMap, EmojiSource, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const keys = {
  sources: storage.defineItem<EmojiSource[]>("local:emojiSources", {
    fallback: [],
  }),
  mergedEmojis: storage.defineItem<EmojiMap>("local:mergedEmojis", {
    fallback: {},
  }),
  settings: storage.defineItem<Settings>("local:settings", {
    fallback: DEFAULT_SETTINGS,
  }),
};

function buildMergedEmojis(sources: EmojiSource[]): EmojiMap {
  const merged: EmojiMap = {};
  for (const source of sources) {
    Object.assign(merged, source.emojis);
  }
  return merged;
}

async function persistMerged(sources: EmojiSource[]): Promise<void> {
  await keys.mergedEmojis.setValue(buildMergedEmojis(sources));
}

export async function getSources(): Promise<EmojiSource[]> {
  return keys.sources.getValue();
}

export async function getSource(id: string): Promise<EmojiSource | undefined> {
  const sources = await getSources();
  return sources.find((s) => s.id === id);
}

export async function addSource(source: EmojiSource): Promise<void> {
  const sources = await getSources();
  sources.push(source);
  await keys.sources.setValue(sources);
  await persistMerged(sources);
}

export async function updateSource(
  id: string,
  updater: (source: EmojiSource) => EmojiSource,
): Promise<void> {
  const sources = await getSources();
  const idx = sources.findIndex((s) => s.id === id);
  if (idx === -1) return;
  sources[idx] = updater(sources[idx]);
  await keys.sources.setValue(sources);
  await persistMerged(sources);
}

export async function removeSource(id: string): Promise<void> {
  const sources = await getSources();
  const filtered = sources.filter((s) => s.id !== id);
  await keys.sources.setValue(filtered);
  await persistMerged(filtered);
}

export async function getMergedEmojis(): Promise<EmojiMap> {
  return keys.mergedEmojis.getValue();
}

export async function getSettings(): Promise<Settings> {
  return keys.settings.getValue();
}

export async function updateSettings(partial: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await keys.settings.setValue({ ...current, ...partial });
}

export function watchMergedEmojis(
  callback: (newVal: EmojiMap, oldVal: EmojiMap) => void,
): () => void {
  return keys.mergedEmojis.watch(callback);
}

export function watchSettings(
  callback: (newVal: Settings, oldVal: Settings) => void,
): () => void {
  return keys.settings.watch(callback);
}

export function watchSources(
  callback: (newVal: EmojiSource[], oldVal: EmojiSource[]) => void,
): () => void {
  return keys.sources.watch(callback);
}
