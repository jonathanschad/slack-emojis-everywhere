import type { EmojiOverridesBySource, EmojiOverride, SourceDomainFilter } from "./types";
import { DEFAULT_SOURCE_DOMAIN_FILTER } from "./types";

export const ICON_PACK_CONFIG_FILE = "emoji-everywhere.config.json";

interface IconPackConfigEmojiOverride extends Partial<EmojiOverride> {
  originalName?: string;
}

export interface IconPackConfig {
  version: 1;
  source?: {
    name?: string;
    domainFilter?: SourceDomainFilter;
  };
  emojis?: Record<string, IconPackConfigEmojiOverride>;
}

export interface ImportedIconPackConfig {
  sourceName: string | null;
  domainFilter: SourceDomainFilter;
  overrides: EmojiOverridesBySource[string];
}

function normalizeDomain(domain: string): string {
  return domain.toLowerCase().trim().replace(/^\.+/, "").replace(/\.+$/, "");
}

function normalizeDomainFilter(filter?: SourceDomainFilter | null): SourceDomainFilter {
  const mode = filter?.mode === "allow" ? "allow" : "deny";
  const domains = Array.isArray(filter?.domains)
    ? Array.from(new Set(filter.domains.map(normalizeDomain).filter(Boolean)))
    : [];

  return { mode, domains };
}

function normalizeEmojiName(name: string): string {
  return name.trim().toLowerCase();
}

function isValidEmojiName(name: string): boolean {
  return /^[\w+-]+$/.test(name);
}

function normalizeOverride(override?: IconPackConfigEmojiOverride | null): EmojiOverride {
  const name = override?.name == null ? null : normalizeEmojiName(override.name);
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
            .filter(Boolean),
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

function isDefaultOverride(override: EmojiOverride): boolean {
  return !override.disabled
    && override.name == null
    && override.aliases.length === 0
    && override.nativeEmojis.length === 0;
}

export function buildIconPackConfig(params: {
  sourceName: string;
  domainFilter: SourceDomainFilter;
  overrides?: EmojiOverridesBySource[string];
}): IconPackConfig {
  const emojis: IconPackConfig["emojis"] = {};

  for (const [emojiName, override] of Object.entries(params.overrides ?? {})) {
    const normalizedName = normalizeEmojiName(emojiName);
    if (!normalizedName || !isValidEmojiName(normalizedName)) continue;

    const normalizedOverride = normalizeOverride(override);
    if (isDefaultOverride(normalizedOverride)) continue;

    emojis[normalizedName] = normalizedOverride;
  }

  return {
    version: 1,
    source: {
      name: params.sourceName.trim() || undefined,
      domainFilter: normalizeDomainFilter(params.domainFilter),
    },
    emojis,
  };
}

export function parseIconPackConfig(
  raw: string,
  availableEmojiNames: string[],
): ImportedIconPackConfig {
  const parsed = JSON.parse(raw) as IconPackConfig;

  if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
    throw new Error("Unsupported icon pack config version");
  }

  const availableNames = new Set(
    availableEmojiNames
      .map(normalizeEmojiName)
      .filter((name) => name.length > 0 && isValidEmojiName(name)),
  );

  const overrides: EmojiOverridesBySource[string] = {};
  for (const [emojiName, override] of Object.entries(parsed.emojis ?? {})) {
    const normalizedName = normalizeEmojiName(emojiName);
    if (!availableNames.has(normalizedName)) continue;

    const normalizedOverride = normalizeOverride(override);
    if (isDefaultOverride(normalizedOverride)) continue;

    overrides[normalizedName] = normalizedOverride;
  }

  const sourceName = typeof parsed.source?.name === "string" && parsed.source.name.trim()
    ? parsed.source.name.trim()
    : null;

  return {
    sourceName,
    domainFilter: normalizeDomainFilter(parsed.source?.domainFilter ?? DEFAULT_SOURCE_DOMAIN_FILTER),
    overrides,
  };
}
