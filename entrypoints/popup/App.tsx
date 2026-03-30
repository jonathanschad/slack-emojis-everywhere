import { useState, useEffect, useCallback } from "react";
import type { ExtensionStatus } from "@/lib/types";
import SourceList from "./components/SourceList";
import AddSource from "./components/AddSource";
import ZipImport from "./components/ZipImport";

const isImportMode = new URLSearchParams(window.location.search).get("mode") === "import";

export default function App() {
  if (isImportMode) {
    return <ZipImport />;
  }

  return <PopupMain />;
}

function PopupMain() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await browser.runtime.sendMessage({
        type: "GET_STATUS",
      });
      if (response?.status) {
        setStatus(response.status);
      }
    } catch (err) {
      console.error("Failed to get status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  const hasSources = (status?.sources.length ?? 0) > 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Emoji Everywhere
          </h1>
          {hasSources && (
            <p className="text-xs text-gray-400 mt-0.5">
              {status!.totalEmojiCount} emojis from{" "}
              {status!.sources.length} source{status!.sources.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
        {hasSources && <AddSource onStatusChange={refreshStatus} />}
      </div>

      {hasSources ? (
        <SourceList
          sources={status!.sources}
          onStatusChange={refreshStatus}
        />
      ) : (
        <div className="pt-2">
          <p className="text-sm text-gray-500 mb-3">
            Add an emoji source to get started.
          </p>
          <AddSource onStatusChange={refreshStatus} inline />
        </div>
      )}
    </div>
  );
}
