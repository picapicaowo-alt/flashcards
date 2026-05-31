"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ClipboardList, Eye, EyeOff, X } from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";

export type PastTestQuestionRow = {
  id: string;
  number: number;
  front: string;
  back: string;
  deck: string;
  tags: string;
  result: "correct" | "wrong" | "omitted" | null;
};

function resultBadge(result?: PastTestQuestionRow["result"]) {
  if (result === "correct") {
    return (
      <span className="inline-flex items-center gap-1 text-green-600">
        <Check size={16} />
        Correct
      </span>
    );
  }
  if (result === "wrong") {
    return (
      <span className="inline-flex items-center gap-1 text-red-600">
        <X size={16} />
        Wrong
      </span>
    );
  }
  if (result === "omitted") return <span className="text-amber-700">Omitted</span>;
  return <span className="text-slate-400">Unanswered</span>;
}

export function PastTestResultsViewer({ rows }: { rows: PastTestQuestionRow[] }) {
  const [view, setView] = useState<"list" | "flashcard">("list");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const active = rows[index];

  function go(nextIndex: number) {
    setIndex(Math.min(Math.max(nextIndex, 0), Math.max(rows.length - 1, 0)));
    setRevealed(false);
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || view !== "flashcard") return;

      if (event.code === "Space") {
        event.preventDefault();
        setRevealed((value) => !value);
      }
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === "ArrowRight") go(index + 1);
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  return (
    <section className="panel overflow-hidden rounded-3xl bg-white/90">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Question Review</h2>
        <div className="inline-flex w-fit rounded-full bg-slate-100 p-1">
          <button
            type="button"
            className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${view === "list" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            onClick={() => setView("list")}
          >
            <ClipboardList size={16} />
            List view
          </button>
          <button
            type="button"
            className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${view === "flashcard" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            onClick={() => setView("flashcard")}
          >
            <BookOpen size={16} />
            Flashcard view
          </button>
        </div>
      </div>

      {view === "list" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Deck</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Question</th>
                <th className="px-4 py-3">Answer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white align-top">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-4 font-medium">{resultBadge(row.result)}</td>
                  <td className="px-4 py-4 text-slate-500">{row.number}</td>
                  <td className="px-4 py-4 text-slate-700">{row.deck}</td>
                  <td className="px-4 py-4 text-slate-500">{row.tags}</td>
                  <td className="max-w-sm px-4 py-4">
                    <MarkdownContent value={row.front} />
                  </td>
                  <td className="max-w-md px-4 py-4">
                    <MarkdownContent value={row.back} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No cards are available for this test.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 sm:p-6">
          {active ? (
            <div className="relative flex min-h-[34rem] flex-col items-center justify-center rounded-[2rem] border border-slate-200 bg-[linear-gradient(90deg,#f8f9ff,#ffffff_45%,#f1fff4)] p-4 sm:p-8">
              <div className="w-full max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:min-h-[27rem] sm:p-10">
                <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span className="badge">Card {active.number} / {rows.length}</span>
                  <span className="badge">{active.deck}</span>
                  {active.tags !== "None" ? <span className="badge">{active.tags}</span> : null}
                  <span className="badge">{resultBadge(active.result)}</span>
                </div>

                <div className="flex min-h-60 flex-col justify-center">
                  <MarkdownContent value={active.front} large />
                  <button className="btn mt-8 w-fit" onClick={() => setRevealed((value) => !value)}>
                    {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
                    {revealed ? "Hide answer" : "Show answer"}
                  </button>
                  {revealed ? (
                    <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                      <MarkdownContent value={active.back} />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <button className="grid size-14 place-items-center rounded-full border-2 border-blue-500 bg-white text-blue-600 shadow-sm" onClick={() => go(index - 1)} disabled={index === 0} title="Previous">
                  <ArrowLeft size={24} />
                </button>
                <span className="badge min-w-24 justify-center">{index + 1} / {rows.length}</span>
                <button className="grid size-14 place-items-center rounded-full border-2 border-blue-500 bg-white text-blue-600 shadow-sm" onClick={() => go(index + 1)} disabled={index === rows.length - 1} title="Next">
                  <ArrowRight size={24} />
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No cards are available for this test.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
