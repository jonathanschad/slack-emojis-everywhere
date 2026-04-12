import { storage, browser } from "#imports";
import type {
  EffectiveEmojiEntry,
  EmojiMap,
  EmojiOverride,
  EmojiOverridesBySource,
  EmojiSource,
  Settings,
  SourceDomainFilter,
} from "./types";
import {
  DEFAULT_SETTINGS,
  EMOJI_REF_PREFIX,
} from "./types";

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
  excludedDomains: storage.defineItem<string[]>("local:excludedDomains", {
    fallback: [],
  }),
  emojiOverrides: storage.defineItem<EmojiOverridesBySource>("local:emojiOverrides", {
    fallback: {},
  }),
};

const EMOJI_NAME_PATTERN = /^[\w+-]+$/;

function normalizeEmojiName(name: string): string {
  return name.trim().toLowerCase();
}

function isValidEmojiName(name: string): boolean {
  return EMOJI_NAME_PATTERN.test(name);
}

function normalizeEmojiOverride(
  override?: Partial<EmojiOverride> | null,
): EmojiOverride {
  const name = override?.name == null
    ? null
    : normalizeEmojiName(override.name);

  const aliases = Array.isArray(override?.aliases)
    ? Array.from(
        new Set(
          override.aliases
            .map(normalizeEmojiName)
            .filter((alias) => alias.length > 0 && isValidEmojiName(alias)),
        ),
      )
    : [];

  const nativeEmojis = Array.isArray(override?.nativeEmojis)
    ? Array.from(
        new Set(
          override.nativeEmojis
            .map((emoji) => emoji.trim())
            .filter((emoji) => emoji.length > 0),
        ),
      )
    : [];

  return {
    disabled: override?.disabled === true,
    name: name && isValidEmojiName(name) ? name : null,
    aliases,
    nativeEmojis,
  };
}

function isDefaultEmojiOverride(override: EmojiOverride): boolean {
  return !override.disabled
    && !override.name
    && override.aliases.length === 0
    && override.nativeEmojis.length === 0;
}

function normalizeEmojiOverrides(
  overrides: EmojiOverridesBySource,
): EmojiOverridesBySource {
  const normalized: EmojiOverridesBySource = {};

  for (const [sourceId, byEmoji] of Object.entries(overrides)) {
    const nextByEmoji: EmojiOverridesBySource[string] = {};

    for (const [emojiName, override] of Object.entries(byEmoji ?? {})) {
      const normalizedName = normalizeEmojiName(emojiName);
      if (!normalizedName || !isValidEmojiName(normalizedName)) continue;

      const normalizedOverride = normalizeEmojiOverride(override);
      if (isDefaultEmojiOverride(normalizedOverride)) continue;

      nextByEmoji[normalizedName] = normalizedOverride;
    }

    if (Object.keys(nextByEmoji).length > 0) {
      normalized[sourceId] = nextByEmoji;
    }
  }

  return normalized;
}

function normalizeEmojiOverridesForSource(
  source: EmojiSource,
  overrides: EmojiOverridesBySource[string],
): EmojiOverridesBySource[string] {
  const normalized = normalizeEmojiOverrides({
    [source.id]: overrides,
  });
  const sourceOverrides = normalized[source.id] ?? {};
  const validNames = new Set(
    Object.keys(source.emojis).map(normalizeEmojiName),
  );

  return Object.fromEntries(
    Object.entries(sourceOverrides).filter(([emojiName]) => validNames.has(emojiName)),
  );
}

function normalizeDomain(domain: string): string {
  return domain.toLowerCase().trim().replace(/^\.+/, "").replace(/\.+$/, "");
}

export function normalizeSourceDomainFilter(
  filter?: Partial<SourceDomainFilter> | null,
): SourceDomainFilter {
  const mode = filter?.mode === "allow" ? "allow" : "deny";
  const domains = Array.isArray(filter?.domains)
    ? Array.from(
        new Set(
          filter.domains
            .map(normalizeDomain)
            .filter(Boolean),
        ),
      )
    : [];

  return { mode, domains };
}

function normalizeSource(source: EmojiSource): EmojiSource {
  return {
    ...source,
    domainFilter: normalizeSourceDomainFilter(source.domainFilter),
  };
}

export function isSourceEnabledForHostname(
  source: EmojiSource,
  hostname: string,
): boolean {
  const normalizedHostname = normalizeDomain(hostname);
  const { mode, domains } = normalizeSource(source).domainFilter;
  const matches = domains.some(
    (domain) =>
      normalizedHostname === domain || normalizedHostname.endsWith(`.${domain}`),
  );

  return mode === "allow" ? matches : !matches;
}

export function getEffectiveEmojiEntriesForSource(
  source: EmojiSource,
  overrides: EmojiOverridesBySource = {},
  options?: { includeDisabled?: boolean },
): EffectiveEmojiEntry[] {
  const normalizedSource = normalizeSource(source);
  const sourceOverrides = overrides[normalizedSource.id] ?? {};
  const entries: EffectiveEmojiEntry[] = [];

  for (const [originalName, ref] of Object.entries(normalizedSource.emojis)) {
    const normalizedOriginalName = normalizeEmojiName(originalName);
    const override = normalizeEmojiOverride(sourceOverrides[normalizedOriginalName]);

    const seenNames = new Set<string>();
    const primaryName = override.name ?? normalizedOriginalName;
    const aliases = override.aliases
      .map(normalizeEmojiName)
      .filter((name) => name.length > 0 && isValidEmojiName(name))
      .filter((name) => {
        if (name === primaryName) return false;
        if (seenNames.has(name)) return false;
        seenNames.add(name);
        return true;
      });

    entries.push({
      sourceId: normalizedSource.id,
      originalName: normalizedOriginalName,
      primaryName,
      aliases,
      nativeEmojis: override.nativeEmojis,
      enabled: !override.disabled,
      ref,
    });
  }

  return options?.includeDisabled ? entries : entries.filter((entry) => entry.enabled);
}

export function buildMergedEmojis(
  sources: EmojiSource[],
  overrides: EmojiOverridesBySource = {},
): EmojiMap {
  const merged: EmojiMap = {};
  for (const source of sources.map(normalizeSource)) {
    for (const entry of getEffectiveEmojiEntriesForSource(source, overrides)) {
      merged[entry.primaryName] = entry.ref;
      for (const alias of entry.aliases) {
        merged[alias] = entry.ref;
      }
    }
  }
  return merged;
}

export function buildMergedEmojisForHostname(
  sources: EmojiSource[],
  hostname: string,
  overrides: EmojiOverridesBySource = {},
): EmojiMap {
  return buildMergedEmojis(
    sources.filter((source) => isSourceEnabledForHostname(source, hostname)),
    overrides,
  );
}

export function buildMergedNativeEmojiMap(
  sources: EmojiSource[],
  overrides: EmojiOverridesBySource = {},
): EmojiMap {
  const merged: EmojiMap = {};
  for (const source of sources.map(normalizeSource)) {
    for (const entry of getEffectiveEmojiEntriesForSource(source, overrides)) {
      for (const nativeEmoji of entry.nativeEmojis) {
        merged[nativeEmoji] = entry.ref;
      }
    }
  }
  return merged;
}

export function buildMergedNativeEmojiMapForHostname(
  sources: EmojiSource[],
  hostname: string,
  overrides: EmojiOverridesBySource = {},
): EmojiMap {
  return buildMergedNativeEmojiMap(
    sources.filter((source) => isSourceEnabledForHostname(source, hostname)),
    overrides,
  );
}

async function persistMerged(sources: EmojiSource[]): Promise<void> {
  const overrides = await getEmojiOverrides();
  await keys.mergedEmojis.setValue(buildMergedEmojis(sources, overrides));
}

export async function getSources(): Promise<EmojiSource[]> {
  const sources = await keys.sources.getValue();
  const normalized = sources.map(normalizeSource);

  if (JSON.stringify(sources) !== JSON.stringify(normalized)) {
    await keys.sources.setValue(normalized);
  }

  return normalized;
}

export async function getSource(id: string): Promise<EmojiSource | undefined> {
  const sources = await getSources();
  return sources.find((s) => s.id === id);
}

export async function getEmojiOverrides(): Promise<EmojiOverridesBySource> {
  const overrides = await keys.emojiOverrides.getValue();
  const normalized = normalizeEmojiOverrides(overrides);

  if (JSON.stringify(overrides) !== JSON.stringify(normalized)) {
    await keys.emojiOverrides.setValue(normalized);
  }

  return normalized;
}

export async function addSource(source: EmojiSource): Promise<void> {
  const sources = await getSources();
  sources.push(normalizeSource(source));
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
  sources[idx] = normalizeSource(updater(sources[idx]));
  await keys.sources.setValue(sources);
  await persistMerged(sources);
}

export async function removeSource(id: string): Promise<void> {
  const sources = await getSources();
  const source = sources.find((s) => s.id === id);
  const emojiNames = source ? Object.keys(source.emojis) : [];
  const filtered = sources.filter((s) => s.id !== id);
  await keys.sources.setValue(filtered);
  const overrides = await getEmojiOverrides();
  if (id in overrides) {
    delete overrides[id];
    await keys.emojiOverrides.setValue(overrides);
  }
  await persistMerged(filtered);
  await removeEmojiImageData(id, emojiNames);
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
  return keys.sources.watch((newVal, oldVal) => {
    callback(newVal.map(normalizeSource), oldVal.map(normalizeSource));
  });
}

export async function updateEmojiOverride(
  sourceId: string,
  emojiName: string,
  patch: Partial<EmojiOverride>,
): Promise<void> {
  const source = await getSource(sourceId);
  if (!source) return;

  const normalizedEmojiName = normalizeEmojiName(emojiName);
  const existingEmojiName = Object.keys(source.emojis).find(
    (name) => normalizeEmojiName(name) === normalizedEmojiName,
  );
  if (!normalizedEmojiName || !existingEmojiName) return;

  const overrides = await getEmojiOverrides();
  const sourceOverrides = { ...(overrides[sourceId] ?? {}) };
  const current = normalizeEmojiOverride(sourceOverrides[normalizedEmojiName]);
  const next = normalizeEmojiOverride({
    ...current,
    ...patch,
  });

  if (isDefaultEmojiOverride(next)) {
    delete sourceOverrides[normalizedEmojiName];
  } else {
    sourceOverrides[normalizedEmojiName] = next;
  }

  if (Object.keys(sourceOverrides).length === 0) {
    delete overrides[sourceId];
  } else {
    overrides[sourceId] = sourceOverrides;
  }

  await keys.emojiOverrides.setValue(overrides);
  await persistMerged(await getSources());
}

export async function replaceEmojiOverridesForSource(
  sourceId: string,
  nextOverrides: EmojiOverridesBySource[string],
): Promise<void> {
  const source = await getSource(sourceId);
  if (!source) return;

  const overrides = await getEmojiOverrides();
  const normalizedSourceOverrides = normalizeEmojiOverridesForSource(source, nextOverrides);

  if (Object.keys(normalizedSourceOverrides).length === 0) {
    delete overrides[sourceId];
  } else {
    overrides[sourceId] = normalizedSourceOverrides;
  }

  await keys.emojiOverrides.setValue(overrides);
  await persistMerged(await getSources());
}

export function watchEmojiOverrides(
  callback: (newVal: EmojiOverridesBySource, oldVal: EmojiOverridesBySource) => void,
): () => void {
  return keys.emojiOverrides.watch((newVal, oldVal) => {
    callback(
      normalizeEmojiOverrides(newVal),
      normalizeEmojiOverrides(oldVal),
    );
  });
}

// ---------------------------------------------------------------------------
// Per-image storage — same format for Slack and ZIP sources
// Key format: emojiImg:{sourceId}:{name} → image URL (remote or data URL)
// ---------------------------------------------------------------------------

const IMG_KEY_PREFIX = "emojiImg:";

/** Read a single emoji image from storage. */
export async function getEmojiImage(
  sourceId: string,
  name: string,
): Promise<string | null> {
  const key = `${IMG_KEY_PREFIX}${sourceId}:${name}`;
  const result = await browser.storage.local.get(key);
  return (result[key] as string) ?? null;
}

/**
 * Bulk-read all images for a source (used by popup grid and export).
 * Derives the key list from the source's emoji ref map.
 */
export async function getEmojiImageData(
  sourceId: string,
): Promise<EmojiMap | null> {
  const source = (await getSources()).find((s) => s.id === sourceId);
  if (!source) return null;

  const names = Object.keys(source.emojis);
  if (names.length === 0) return null;

  const storageKeys = names.map((n) => `${IMG_KEY_PREFIX}${sourceId}:${n}`);
  const result = await browser.storage.local.get(storageKeys);

  const images: EmojiMap = {};
  for (const name of names) {
    const val = result[`${IMG_KEY_PREFIX}${sourceId}:${name}`];
    if (typeof val === "string" && val) images[name] = val;
  }
  return Object.keys(images).length > 0 ? images : null;
}

const STORAGE_BATCH_SIZE = 50;

/** Write all images for a source as individual keys, batched to avoid large single writes. */
export async function setEmojiImageData(
  sourceId: string,
  images: EmojiMap,
): Promise<void> {
  const entries = Object.entries(images);
  for (let i = 0; i < entries.length; i += STORAGE_BATCH_SIZE) {
    const batch = entries.slice(i, i + STORAGE_BATCH_SIZE);
    const items: Record<string, string> = {};
    for (const [name, url] of batch) {
      items[`${IMG_KEY_PREFIX}${sourceId}:${name}`] = url;
    }
    await browser.storage.local.set(items);
  }
}

/** Remove all image keys for a source. */
export async function removeEmojiImageData(
  sourceId: string,
  emojiNames: string[],
): Promise<void> {
  if (emojiNames.length === 0) return;
  await browser.storage.local.remove(
    emojiNames.map((n) => `${IMG_KEY_PREFIX}${sourceId}:${n}`),
  );
}

// ---------------------------------------------------------------------------
// Excluded domains
// ---------------------------------------------------------------------------

export async function getExcludedDomains(): Promise<string[]> {
  return keys.excludedDomains.getValue();
}

export async function addExcludedDomain(domain: string): Promise<void> {
  const domains = await getExcludedDomains();
  const normalized = domain.toLowerCase().trim();
  if (!normalized || domains.includes(normalized)) return;
  domains.push(normalized);
  await keys.excludedDomains.setValue(domains);
}

export async function removeExcludedDomain(domain: string): Promise<void> {
  const domains = await getExcludedDomains();
  const filtered = domains.filter((d) => d !== domain.toLowerCase().trim());
  await keys.excludedDomains.setValue(filtered);
}

export function watchExcludedDomains(
  callback: (newVal: string[], oldVal: string[]) => void,
): () => void {
  return keys.excludedDomains.watch(callback);
}

/** Build a ref map: name → "ref:{sourceId}/{name}" */
export function buildEmojiRefs(
  sourceId: string,
  emojiNames: string[],
): EmojiMap {
  const refs: EmojiMap = {};
  for (const name of emojiNames) {
    refs[name] = `${EMOJI_REF_PREFIX}${sourceId}/${name}`;
  }
  return refs;
}
