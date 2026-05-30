"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Flag, RotateCcw, Star, X } from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { formatDate } from "@/lib/dates";

type StudyCard = {
  id: string;
  front: string;
  back: string;
  deckName: string;
  tags: string[];
  status: string;
  isMarked: boolean;
  isOmitted: boolean;
  correctCount: number;
  incorrectCount: number;
  reviewCount: number;
  nextReviewAt: string | null;
};

type StudySession = {
  id: string;
  mode: string;
  cardCount: number;
  correctCount: number;
  wrongCount: number;
  omittedCount: number;
};

type Answer = "correct" | "wrong" | "omitted";

export function StudySessionPlayer({
  session,
  initialCards,
  initialAnswers,
}: {
  session: StudySession;
  initialCards: StudyCard[];
  initialAnswers: Record<string, Answer>;
}) {
  const [cards, setCards] = useState(initialCards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>(initialAnswers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const card = cards[index];
  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((answer) => answer === "correct").length;
  const wrongCount = Object.values(answers).filter((answer) => answer === "wrong").length;
  const accuracy = correctCount + wrongCount === 0 ? "0%" : `${((correctCount / (correctCount + wrongCount)) * 100).toFixed(1)}%`;

  const answerLabel = useMemo(() => answers[card?.id], [answers, card?.id]);

  function go(nextIndex: number) {
    setIndex(Math.min(Math.max(nextIndex, 0), cards.length - 1));
    setRevealed(false);
    setError("");
  }

  async function answer(result: Answer) {
    if (!card || saving) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/study/${session.id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, result }),
    });
    const body = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      setError(body?.error ?? "Could not save answer.");
      return;
    }

    setCards((current) => current.map((item) => (item.id === card.id ? { ...item, ...body.card } : item)));
    setAnswers((current) => ({ ...current, [card.id]: result }));
  }

  async function patchFlag(patch: Record<string, unknown>) {
    if (!card) return;
    const response = await fetch(`/api/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Could not update card.");
      return;
    }
    setCards((current) => current.map((item) => (item.id === card.id ? { ...item, ...body.card } : item)));
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;

      if (event.code === "Space") {
        event.preventDefault();
        setRevealed((value) => !value);
      }
      if (event.key === "1") void answer("wrong");
      if (event.key === "2") void answer("correct");
      if (event.key.toLowerCase() === "m") void patchFlag({ isMarked: !card.isMarked });
      if (event.key.toLowerCase() === "o") void patchFlag({ isOmitted: !card.isOmitted });
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === "ArrowRight") go(index + 1);
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  if (!card) return null;

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-600">Study Session</p>
          <h1 className="text-2xl font-semibold tracking-normal">{session.mode}</h1>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="badge">Card {index + 1} / {cards.length}</span>
          <span className="badge">Correct: {correctCount}</span>
          <span className="badge">Wrong: {wrongCount}</span>
          <span className="badge">Accuracy: {accuracy}</span>
          <span className="badge">Answered: {answeredCount}</span>
        </div>
      </div>

      <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(90deg,#f8f9ff,#ffffff_45%,#f1fff4)] p-4 sm:p-8">
        <div className="w-full max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:min-h-[34rem] sm:p-12">
          <div className="mb-8 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="badge">{card.deckName}</span>
            {card.tags.map((tag) => (
              <span key={tag} className="badge">{tag}</span>
            ))}
            {answerLabel ? <span className="badge">Answered: {answerLabel}</span> : null}
            {card.isMarked ? <span className="badge">Marked</span> : null}
            {card.isOmitted ? <span className="badge">Omitted</span> : null}
          </div>

          <div className="flex min-h-72 flex-col justify-center">
            <MarkdownContent value={card.front} large />
            <button className="btn mt-8 w-fit" onClick={() => setRevealed((value) => !value)}>
              {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
              {revealed ? "Hide answer" : "Explain"}
            </button>
            {revealed ? (
              <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                <MarkdownContent value={card.back} />
              </div>
            ) : null}
          </div>

          <div className="mt-8 grid gap-3 border-t border-slate-100 pt-5 text-sm text-slate-500 sm:grid-cols-3">
            <span>Status: {card.status}</span>
            <span>Reviews: {card.reviewCount}</span>
            <span>Next: {formatDate(card.nextReviewAt)}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <button className="grid size-16 place-items-center rounded-full border-2 border-blue-500 bg-white text-blue-600 shadow-sm" onClick={() => go(index - 1)} disabled={index === 0} title="Previous">
            <ArrowLeft size={26} />
          </button>
          <button className="btn btn-red h-14 min-w-32 text-lg" onClick={() => answer("wrong")} disabled={saving}>
            <X size={26} />
            {wrongCount}
          </button>
          <button className="btn btn-green h-14 min-w-32 text-lg" onClick={() => answer("correct")} disabled={saving}>
            {correctCount}
            <Check size={28} />
          </button>
          <button className="grid size-16 place-items-center rounded-full border-2 border-blue-500 bg-white text-blue-600 shadow-sm" onClick={() => go(index + 1)} disabled={index === cards.length - 1} title="Next">
            <ArrowRight size={26} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button className="btn" onClick={() => patchFlag({ isMarked: !card.isMarked })}>
            <Star size={17} />
            {card.isMarked ? "Unmark" : "Mark"}
          </button>
          <button className="btn" onClick={() => patchFlag({ isOmitted: !card.isOmitted })}>
            <Flag size={17} />
            {card.isOmitted ? "Unomit" : "Omit"}
          </button>
          <button className="btn" onClick={() => setRevealed(false)}>
            <RotateCcw size={17} />
            Reset view
          </button>
        </div>
      </section>

      {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
