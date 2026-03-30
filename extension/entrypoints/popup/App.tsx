import { useState, useEffect } from "react";
import type { ExtensionStatus } from "@/lib/types";
import SignIn from "./components/SignIn";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = async () => {
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
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  if (!status?.authenticated) {
    return <SignIn onComplete={refreshStatus} />;
  }

  return <Dashboard status={status} onStatusChange={refreshStatus} />;
}
