"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, PlayCircle, Search, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { RedoTestButton } from "@/components/RedoTestButton";

export type PastTestRow = {
  id: string;
  name: string;
  mode: string;
  questionPool: string;
  decks: string;
  cardCount: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  omittedCount: number;
  score: string;
  startedAt: string;
  completedAt: string | null;
};

const ageOptions = [
  { label: "1 month", months: 1 },
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
];

export function PastTestsManager({ sessions }: { sessions: PastTestRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(sessions);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [olderThanMonths, setOlderThanMonths] = useState(3);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      return [
        row.name,
        row.mode,
        row.questionPool,
        row.decks,
        row.score,
        formatDate(row.startedAt),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [rows, search]);

  const selectedIds = Object.entries(selected)
    .filter(([, value]) => value)
    .map(([id]) => id)
    .filter((id) => rows.some((row) => row.id === id));

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selected[row.id]);

  function toggleAllVisible(checked: boolean) {
    setSelected((current) => ({
      ...current,
      ...Object.fromEntries(filteredRows.map((row) => [row.id, checked])),
    }));
  }

  async function deleteTests(payload: { sessionIds?: string[]; olderThanMonths?: number }, prompt: string) {
    if (busy) return;
    if (!window.confirm(prompt)) return;

    setBusy(true);
    setMessage("");
    setError("");

    const response = await fetch("/api/study/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);

    if (!response.ok) {
      setError(body?.error ?? "Could not delete past tests.");
      return;
    }

    const deletedIds = new Set<string>(body.deletedSessionIds ?? []);
    setRows((current) => current.filter((row) => !deletedIds.has(row.id)));
    setSelected((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !deletedIds.has(id))));
    setMessage(`Deleted ${body.deletedSessions ?? 0} tests and ${body.deletedReviewLogs ?? 0} review logs.`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="panel overflow-hidden rounded-3xl bg-white/90">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn"
              disabled={selectedIds.length === 0 || busy}
              onClick={() => deleteTests({ sessionIds: selectedIds }, `Delete ${selectedIds.length} selected tests?`)}
            >
              <Trash2 size={17} />
              Delete selected
            </button>
            <select
              className="field w-40"
              value={olderThanMonths}
              onChange={(event) => setOlderThanMonths(Number(event.target.value))}
            >
              {ageOptions.map((option) => (
                <option key={option.months} value={option.months}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-red"
              disabled={busy}
              onClick={() => deleteTests({ olderThanMonths }, `Delete completed tests older than ${olderThanMonths} month${olderThanMonths === 1 ? "" : "s"}?`)}
            >
              <Trash2 size={17} />
              Delete older
            </button>
          </div>

          <label className="relative block w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              className="field pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
            />
          </label>
        </div>

        {message ? <p className="border-b border-green-100 bg-green-50 px-5 py-3 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => toggleAllVisible(event.target.checked)}
                    aria-label="Select all visible tests"
                  />
                </th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Q. Pool</th>
                <th className="px-4 py-3">Decks</th>
                <th className="px-4 py-3"># Cards</th>
                <th className="px-4 py-3">Answered</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[row.id])}
                      onChange={(event) => setSelected((current) => ({ ...current, [row.id]: event.target.checked }))}
                      aria-label={`Select ${row.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={row.completedAt ? "badge" : "badge border-amber-200 bg-amber-50 text-amber-700"}>
                      {row.completedAt ? row.score : "In progress"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(row.startedAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{row.mode}</td>
                  <td className="px-4 py-3 text-slate-600">{row.questionPool}</td>
                  <td className="px-4 py-3 text-slate-600">{row.decks}</td>
                  <td className="px-4 py-3 text-slate-600">{row.cardCount}</td>
                  <td className="px-4 py-3 text-slate-600">{row.answeredCount} / {row.cardCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {!row.completedAt ? (
                        <Link href={`/study/${row.id}`} className="btn h-9 min-h-9 px-3" title="Resume">
                          <PlayCircle size={16} />
                          Resume
                        </Link>
                      ) : null}
                      <Link href={`/study/history/${row.id}`} className="btn h-9 min-h-9 px-3" title="Results">
                        <ClipboardList size={16} />
                        Results
                      </Link>
                      <RedoTestButton sessionId={row.id} className="btn h-9 min-h-9 px-3" label="Redo" />
                      <button
                        type="button"
                        className="btn btn-red h-9 min-h-9 px-3"
                        disabled={busy}
                        onClick={() => deleteTests({ sessionIds: [row.id] }, `Delete ${row.name}?`)}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    No past tests found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
