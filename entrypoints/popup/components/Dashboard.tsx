import { useState } from "react";
import type { ExtensionStatus } from "@/lib/types";
import EmojiGrid from "./EmojiGrid";

interface Props {
  status: ExtensionStatus;
  onStatusChange: () => void;
}

export default function Dashboard({ status, onStatusChange }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await browser.runtime.sendMessage({
        type: "FETCH_EMOJIS",
      });

      if (!response?.success) {
        setError(response?.error ?? "Failed to refresh emojis");
      }

      onStatusChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    await browser.runtime.sendMessage({ type: "DISCONNECT" });
    onStatusChange();
  };

  const lastRefreshText = status.lastRefresh
    ? formatRelativeTime(status.lastRefresh)
    : "Never";

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Slack Emoji Everywhere
          </h1>
          {status.teamName && (
            <p className="text-sm text-gray-500">{status.teamName}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-green-700 font-medium">Connected</span>
        </div>
      </div>

      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
        <div className="text-sm">
          <span className="font-semibold text-gray-900">
            {status.emojiCount}
          </span>{" "}
          <span className="text-gray-500">emojis loaded</span>
          <span className="text-gray-400 mx-2">&middot;</span>
          <span className="text-gray-500 text-xs">
            Synced {lastRefreshText}
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-50 cursor-pointer"
          title="Refresh emojis"
        >
          <svg
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <EmojiGrid />

      <button
        onClick={handleDisconnect}
        className="w-full text-gray-400 text-xs hover:text-red-500 transition-colors py-1 cursor-pointer"
      >
        Disconnect workspace
      </button>
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
