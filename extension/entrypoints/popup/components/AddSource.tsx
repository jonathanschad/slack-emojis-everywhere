import { useState, useRef, useEffect } from "react";

interface Props {
  onStatusChange: () => void;
  inline?: boolean;
}

export default function AddSource({ onStatusChange, inline }: Props) {
  const [open, setOpen] = useState(false);
  const [slackLoading, setSlackLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handleSlackSignIn = async () => {
    setOpen(false);
    setSlackLoading(true);
    setError(null);

    try {
      const response = await browser.runtime.sendMessage({
        type: "START_OAUTH",
      });
      if (response?.success) {
        onStatusChange();
      } else {
        setError(response?.error ?? "Authentication failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSlackLoading(false);
    }
  };

  const handleZipImport = () => {
    setOpen(false);
    browser.windows.create({
      url: browser.runtime.getURL("popup.html?mode=import"),
      type: "popup",
      width: 420,
      height: 460,
    });
  };

  const slackButton = (btnClass: string) => (
    <button
      onClick={handleSlackSignIn}
      disabled={slackLoading}
      className={btnClass}
    >
      {slackLoading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent shrink-0" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 54 54" fill="none" className="shrink-0">
          <path
            d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386"
            fill="#36C5F0"
          />
          <path
            d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387"
            fill="#2EB67D"
          />
          <path
            d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386"
            fill="#ECB22E"
          />
          <path
            d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.25m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.25a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.386"
            fill="#E01E5A"
          />
        </svg>
      )}
      <span>Slack workspace</span>
    </button>
  );

  const zipButton = (btnClass: string) => (
    <button
      onClick={handleZipImport}
      className={btnClass}
    >
      <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
        />
      </svg>
      <span>Import ZIP</span>
    </button>
  );

  if (inline) {
    return (
      <div className="space-y-2">
        {slackButton(
          "w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 text-sm text-gray-700"
        )}
        {zipButton(
          "w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer text-sm text-gray-700"
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={slackLoading}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
        title="Add emoji source"
      >
        {slackLoading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent" />
        ) : (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
          {slackButton(
            "w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors cursor-pointer text-left text-sm text-gray-700"
          )}
          {zipButton(
            "w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors cursor-pointer text-left text-sm text-gray-700"
          )}
        </div>
      )}

      {error && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 z-10">
          {error}
        </div>
      )}
    </div>
  );
}
