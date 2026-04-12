import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  getSource,
  getEmojiOverrides,
  getEffectiveEmojiEntriesForSource,
} from "@/lib/storage";
import { searchEmojis } from "@/lib/emoji-search";
import { resolveImageUrl, TRANSPARENT_PIXEL } from "@/lib/emoji-image-resolver";
import type {
  EffectiveEmojiEntry,
  EmojiMap,
  EmojiOverride,
} from "@/lib/types";

const BATCH_SIZE = 100;

interface Props {
  sourceId: string;
  onStatusChange: () => void | Promise<void>;
}

interface EmojiGridEntry extends EffectiveEmojiEntry {
  override: EmojiOverride;
}

const DEFAULT_OVERRIDE: EmojiOverride = {
  disabled: false,
  name: null,
  aliases: [],
  nativeEmojis: [],
};

export default function EmojiGrid({ sourceId, onStatusChange }: Props) {
  const [entries, setEntries] = useState<EmojiGridEntry[]>([]);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [selectedEntry, setSelectedEntry] = useState<EmojiGridEntry | null>(null);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadEntries = useCallback(async () => {
    const [source, overrides] = await Promise.all([
      getSource(sourceId),
      getEmojiOverrides(),
    ]);

    if (!source) {
      setEntries([]);
      setSelectedEntry(null);
      return;
    }

    const sourceOverrides = overrides[sourceId] ?? {};
    const nextEntries = getEffectiveEmojiEntriesForSource(source, overrides, {
      includeDisabled: true,
    }).map((entry) => ({
      ...entry,
      override: sourceOverrides[entry.originalName] ?? DEFAULT_OVERRIDE,
    }));

    nextEntries.sort((a, b) => a.primaryName.localeCompare(b.primaryName));
    setEntries(nextEntries);
    setSelectedEntry((current) =>
      current
        ? nextEntries.find((entry) => entry.originalName === current.originalName) ?? null
        : null,
    );
  }, [sourceId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const searchableMap = useMemo(() => {
    const map: EmojiMap = {};
    for (const entry of entries) {
      map[entry.primaryName] = entry.ref;
      for (const alias of entry.aliases) {
        map[alias] = entry.ref;
      }
    }
    return map;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!search) return entries;

    const matchedNames = new Set(
      searchEmojis(search, searchableMap).map((result) => result.name),
    );

    return entries.filter((entry) =>
      matchedNames.has(entry.primaryName)
      || entry.aliases.some((alias) => matchedNames.has(alias)),
    );
  }, [entries, search, searchableMap]);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    scrollRef.current?.scrollTo(0, 0);
  }, [search]);

  const visibleEntries = useMemo(
    () => filteredEntries.slice(0, visibleCount),
    [filteredEntries, visibleCount],
  );

  const loadMore = useCallback(() => {
    setVisibleCount((prev) =>
      Math.min(prev + BATCH_SIZE, filteredEntries.length),
    );
  }, [filteredEntries.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (observedEntries) => {
        if (observedEntries[0].isIntersecting) loadMore();
      },
      { root: scrollRef.current, rootMargin: "100px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const saveOverride = useCallback(async (
    emojiName: string,
    override: Partial<EmojiOverride>,
  ) => {
    setSavingName(emojiName);
    setError(null);

    try {
      const response = await browser.runtime.sendMessage({
        type: "UPDATE_EMOJI_OVERRIDE",
        sourceId,
        emojiName,
        override,
      });

      if (!response?.success) {
        throw new Error(response?.error ?? "Failed to save emoji settings");
      }

      await loadEntries();
      await onStatusChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save emoji settings");
    } finally {
      setSavingName(null);
    }
  }, [loadEntries, onStatusChange, sourceId]);

  if (entries.length === 0) {
    return (
      <div className="text-center text-xs text-gray-400 py-2">
        No emojis in this source
      </div>
    );
  }

  const hasMore = visibleCount < filteredEntries.length;

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${entries.length} emojis...`}
        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div
        ref={scrollRef}
        className="grid grid-cols-8 gap-1 max-h-36 overflow-y-auto p-1"
      >
        {visibleEntries.map((entry) => (
          <EmojiCell
            key={entry.originalName}
            entry={entry}
            onClick={() => setSelectedEntry(entry)}
          />
        ))}

        {hasMore && <div ref={sentinelRef} className="col-span-8 h-1" />}
      </div>

      {filteredEntries.length === 0 && search && (
        <p className="text-center text-xs text-gray-400 py-1">
          No emojis matching &ldquo;{search}&rdquo;
        </p>
      )}

      {selectedEntry && (
        <EmojiConfigModal
          entry={selectedEntry}
          saving={savingName === selectedEntry.originalName}
          onClose={() => setSelectedEntry(null)}
          onSave={saveOverride}
        />
      )}
    </div>
  );
}

function EmojiCell({
  entry,
  onClick,
}: {
  entry: EmojiGridEntry;
  onClick: () => void;
}) {
  const [src, setSrc] = useState(TRANSPARENT_PIXEL);

  useEffect(() => {
    let cancelled = false;
    resolveImageUrl(entry.ref).then((resolved) => {
      if (!cancelled) setSrc(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [entry.ref]);

  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded transition-colors group relative cursor-pointer ${
        entry.enabled ? "hover:bg-gray-100" : "bg-gray-100 opacity-60 hover:bg-gray-200"
      }`}
      title={`:${entry.primaryName}:`}
    >
      <img
        src={src}
        alt={`:${entry.primaryName}:`}
        className="w-5 h-5"
        loading="lazy"
      />
      {!entry.enabled && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-gray-500" />
      )}
    </button>
  );
}

function EmojiConfigModal({
  entry,
  saving,
  onClose,
  onSave,
}: {
  entry: EmojiGridEntry;
  saving: boolean;
  onClose: () => void;
  onSave: (emojiName: string, override: Partial<EmojiOverride>) => Promise<void>;
}) {
  const [src, setSrc] = useState(TRANSPARENT_PIXEL);
  const [name, setName] = useState(entry.override.name ?? "");
  const [aliases, setAliases] = useState(entry.override.aliases.join(", "));
  const [nativeEmojis, setNativeEmojis] = useState(entry.override.nativeEmojis.join(" "));

  useEffect(() => {
    let cancelled = false;
    resolveImageUrl(entry.ref).then((resolved) => {
      if (!cancelled) setSrc(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [entry.ref]);

  useEffect(() => {
    setName(entry.override.name ?? "");
    setAliases(entry.override.aliases.join(", "));
    setNativeEmojis(entry.override.nativeEmojis.join(" "));
  }, [entry.override.aliases, entry.override.name, entry.override.nativeEmojis, entry.originalName]);

  const aliasPreview = entry.aliases.length > 0
    ? entry.aliases.map((alias) => `:${alias}:`).join(" ")
    : "No extra aliases";
  const nativeEmojiPreview = entry.nativeEmojis.length > 0
    ? entry.nativeEmojis.join(" ")
    : "No native emoji triggers";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-gray-100 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-50">
            <img src={src} alt={`:${entry.primaryName}:`} className="h-7 w-7" loading="lazy" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-gray-900">
                :{entry.primaryName}:
              </p>
              {saving && (
                <span className="text-[11px] text-gray-400">Saving...</span>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              Original: :{entry.originalName}:
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Active names: {aliasPreview}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Native triggers: {nativeEmojiPreview}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 p-4">
          <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <span className="text-xs font-medium text-gray-700">Enabled</span>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              checked={entry.enabled}
              onChange={(e) => {
                void onSave(entry.originalName, { disabled: !e.target.checked });
              }}
            />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-medium text-gray-600">Primary name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                void onSave(entry.originalName, { name: name.trim() || null });
              }}
              placeholder={entry.originalName}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-medium text-gray-600">Aliases</span>
            <input
              type="text"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              onBlur={() => {
                void onSave(entry.originalName, {
                  aliases: aliases
                    .split(",")
                    .map((alias) => alias.trim())
                    .filter(Boolean),
                });
              }}
              placeholder="name2, name3"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-medium text-gray-600">Replace native emojis</span>
            <input
              type="text"
              value={nativeEmojis}
              onChange={(e) => setNativeEmojis(e.target.value)}
              onBlur={() => {
                void onSave(entry.originalName, {
                  nativeEmojis: nativeEmojis
                    .split(/\s+/)
                    .map((emoji) => emoji.trim())
                    .filter(Boolean),
                });
              }}
              placeholder="🥸 🤖"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-[11px] text-gray-500">
              Any matching emoji character on the page will be swapped for this custom emoji.
            </p>
          </label>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setName("");
                setAliases("");
                setNativeEmojis("");
                void onSave(entry.originalName, {
                  disabled: false,
                  name: null,
                  aliases: [],
                  nativeEmojis: [],
                });
              }}
              className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Reset Emoji
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
