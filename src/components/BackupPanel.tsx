"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";

export function BackupPanel() {
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function readFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function importBackup() {
    setError("");
    setMessage("");
    setLoading(true);

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      setLoading(false);
      setError("Paste or choose a valid JSON backup file.");
      return;
    }

    const response = await fetch("/api/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Import failed.");
      return;
    }

    setMessage(`Imported ${body.decks} decks, ${body.cards} cards, ${body.tags} tags, ${body.sessions} sessions, and ${body.reviewLogs} review logs. Skipped ${body.skippedCards} duplicate cards.`);
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="panel rounded-3xl p-5">
        <h2 className="text-lg font-semibold">Export</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Download a full JSON snapshot before migrations, server moves, or major imports.
        </p>
        <a href="/api/backup/export" className="btn btn-primary mt-5">
          <Download size={17} />
          Export JSON
        </a>
      </div>

      <div className="panel rounded-3xl p-5">
        <h2 className="text-lg font-semibold">Import</h2>
        <div className="mt-4 grid gap-4">
          <input className="field" type="file" accept="application/json,.json" onChange={(event) => readFile(event.target.files?.[0])} />
          <textarea
            className="field min-h-72 font-mono text-sm leading-6"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste backup JSON here"
          />
          {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p> : null}
          <button className="btn btn-primary w-fit" onClick={importBackup} disabled={loading || !text.trim()}>
            <Upload size={17} />
            {loading ? "Importing..." : "Import backup"}
          </button>
        </div>
      </div>
    </section>
  );
}
