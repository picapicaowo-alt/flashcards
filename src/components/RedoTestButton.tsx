"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

export function RedoTestButton({
  sessionId,
  className = "btn",
  label = "Redo",
}: {
  sessionId: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function redoTest() {
    if (loading) return;
    setLoading(true);
    setError("");

    const response = await fetch(`/api/study/${sessionId}/redo`, { method: "POST" });
    const body = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Could not redo this test.");
      return;
    }

    router.push(`/study/${body.sessionId}`);
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" className={className} onClick={redoTest} disabled={loading}>
        <RotateCcw size={16} />
        {loading ? "Starting..." : label}
      </button>
      {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
    </span>
  );
}
