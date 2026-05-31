"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Info, PlayCircle, Shuffle, X } from "lucide-react";
import { formatDate, isDueToday, isOverdue } from "@/lib/dates";

type DeckSummary = { id: string; name: string; total: number };
type ActiveStudySession = {
  id: string;
  mode: string;
  cardCount: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  omittedCount: number;
  startedAt: string;
};
type StudyCardSummary = {
  id: string;
  deckId: string;
  status: string;
  isMarked: boolean;
  isOmitted: boolean;
  incorrectCount: number;
  correctCount: number;
  nextReviewAt: string | null;
  createdAt: string;
};

const statusOptions = [
  { key: "unused", label: "Unused" },
  { key: "incorrect", label: "Incorrect" },
  { key: "difficult", label: "Most difficult" },
  { key: "marked", label: "Marked" },
  { key: "omitted", label: "Omitted" },
  { key: "correct", label: "Correct" },
  { key: "due", label: "Due today" },
  { key: "overdue", label: "Overdue" },
];

const modeOptions = [
  { key: "standard", label: "Standard Review" },
  { key: "due", label: "Due Cards Only" },
  { key: "wrong", label: "Wrong Bank" },
  { key: "marked", label: "Marked Cards" },
  { key: "random", label: "Random Mix" },
];

function normalizeMode(mode: string) {
  return modeOptions.some((option) => option.key === mode) ? mode : "standard";
}

function defaultFilters(mode: string): Record<string, boolean> {
  if (mode === "due") return { due: true, overdue: true };
  if (mode === "wrong") return { incorrect: true };
  if (mode === "marked") return { marked: true };
  if (mode === "random") return {};
  return { unused: true, incorrect: true };
}

function cardMatchesStatus(card: StudyCardSummary, key: string) {
  if (key === "unused") return card.status === "unused";
  if (key === "incorrect") return card.status === "incorrect";
  if (key === "difficult") return card.incorrectCount > 0;
  if (key === "marked") return card.isMarked;
  if (key === "omitted") return card.isOmitted;
  if (key === "correct") return card.status === "review" || card.status === "correct";
  if (key === "due") return isDueToday(card.nextReviewAt);
  if (key === "overdue") return isOverdue(card.nextReviewAt);
  return false;
}

function cardMatchesMode(card: StudyCardSummary, mode: string) {
  if (mode === "due") return Boolean(card.nextReviewAt) && (isDueToday(card.nextReviewAt) || isOverdue(card.nextReviewAt));
  if (mode === "wrong") return card.status === "incorrect";
  if (mode === "marked") return card.isMarked;
  return true;
}

export function StudySetupForm({
  initialMode,
  activeSession,
  decks,
  cards,
}: {
  initialMode: string;
  activeSession?: ActiveStudySession | null;
  decks: DeckSummary[];
  cards: StudyCardSummary[];
}) {
  const initialQuestionMode = normalizeMode(initialMode);
  const [mode, setMode] = useState(initialQuestionMode);
  const [endedSessionId, setEndedSessionId] = useState<string | null>(null);
  const [showSetupOverride, setShowSetupOverride] = useState(false);
  const [filters, setFilters] = useState<Record<string, boolean>>(() => (
    initialMode === "difficult" ? { difficult: true } : defaultFilters(initialQuestionMode)
  ));
  const [selectedDecks, setSelectedDecks] = useState<Record<string, boolean>>({});
  const [count, setCount] = useState(20);
  const [shuffle, setShuffle] = useState(true);
  const [includeOmitted, setIncludeOmitted] = useState(false);
  const [includeCorrect, setIncludeCorrect] = useState(false);
  const [direction, setDirection] = useState("front-back");
  const [error, setError] = useState("");
  const [activeError, setActiveError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);

  const selectedFilterKeys = Object.entries(filters)
    .filter(([, value]) => value)
    .map(([key]) => key);

  const selectedDeckIds = Object.entries(selectedDecks)
    .filter(([, value]) => value)
    .map(([id]) => id);
  const visibleActiveSession = activeSession?.id === endedSessionId ? null : activeSession;
  const showSetup = showSetupOverride || !visibleActiveSession;

  const matchingCards = useMemo(() => {
    return cards.filter((card) => {
      if (!includeOmitted && !filters.omitted && card.isOmitted) return false;
      if (!includeCorrect && card.status !== "unused" && card.status !== "incorrect" && card.status !== "learning" && selectedFilterKeys.length === 0 && mode !== "due" && mode !== "marked") {
        return false;
      }
      if (selectedDeckIds.length > 0 && !selectedDeckIds.includes(card.deckId)) return false;
      if (!cardMatchesMode(card, mode)) return false;
      if (selectedFilterKeys.length > 0 && !selectedFilterKeys.some((key) => cardMatchesStatus(card, key))) return false;
      return true;
    });
  }, [cards, filters.omitted, includeCorrect, includeOmitted, mode, selectedDeckIds, selectedFilterKeys]);

  const deckCounts = useMemo(() => {
    return decks.map((deck) => ({
      ...deck,
      matching: matchingCards.filter((card) => card.deckId === deck.id).length,
    }));
  }, [decks, matchingCards]);

  const maxAllowed = matchingCards.length;
  const requestedCount = Math.min(Math.max(count, 0), maxAllowed);
  const activeProgress = visibleActiveSession
    ? Math.min(100, Math.round((visibleActiveSession.answeredCount / Math.max(visibleActiveSession.cardCount, 1)) * 100))
    : 0;

  function chooseMode(nextMode: string) {
    setMode(nextMode);
    setFilters(defaultFilters(nextMode));
  }

  function showNewSessionSetup() {
    setActiveError("");
    setShowSetupOverride(true);
  }

  async function endActiveSession() {
    if (!visibleActiveSession || ending) return;

    setActiveError("");
    setEnding(true);
    const response = await fetch(`/api/study/${visibleActiveSession.id}/end`, { method: "POST" });
    const body = await response.json().catch(() => null);
    setEnding(false);

    if (!response.ok) {
      setActiveError(body?.error ?? "Could not end session.");
      return;
    }

    setEndedSessionId(visibleActiveSession.id);
    setShowSetupOverride(true);
  }

  async function startSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/study/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        filters,
        deckIds: selectedDeckIds,
        count: requestedCount,
        shuffle,
        includeOmitted,
        includeCorrect,
        direction,
      }),
    });

    const body = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Could not start session.");
      return;
    }

    window.location.href = `/study/${body.sessionId}`;
  }

  return (
    <div className="space-y-4">
      {visibleActiveSession ? (
        <section className="panel overflow-hidden rounded-3xl bg-white/90">
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-blue-600">Unfinished session</p>
                <span className="badge">{visibleActiveSession.mode}</span>
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal">Resume where you left off</h2>
              <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-4">
                <span className="badge">{visibleActiveSession.answeredCount} / {visibleActiveSession.cardCount} answered</span>
                <span className="badge">Correct: {visibleActiveSession.correctCount}</span>
                <span className="badge">Wrong: {visibleActiveSession.wrongCount}</span>
                <span className="badge">Started: {formatDate(visibleActiveSession.startedAt)}</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${activeProgress}%` }} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Link href={`/study/${visibleActiveSession.id}`} className="btn btn-primary">
                <PlayCircle size={17} />
                Resume
              </Link>
              <button type="button" className="btn" onClick={showNewSessionSetup}>
                <ArrowRight size={17} />
                Start new
              </button>
              <button type="button" className="btn btn-red" onClick={endActiveSession} disabled={ending}>
                <X size={17} />
                {ending ? "Ending..." : "End now"}
              </button>
            </div>
          </div>
          {activeError ? <p className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{activeError}</p> : null}
        </section>
      ) : null}

      {showSetup ? (
        <form onSubmit={startSession} className="panel overflow-hidden rounded-3xl bg-white/90">
      <section className="border-b border-slate-200 p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Question Mode</h2>
          <Info size={16} className="text-blue-500" />
        </div>
        <div className="mt-4 inline-flex flex-wrap rounded-full bg-slate-100 p-1">
          {modeOptions.map((option) => (
            <button
              type="button"
              key={option.key}
              onClick={() => chooseMode(option.key)}
              className={`min-h-9 rounded-full px-4 text-sm font-medium transition ${mode === option.key ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
          {statusOptions.map((option) => (
            <label key={option.key} className="inline-flex items-center gap-2 text-base font-medium text-slate-700">
              <input
                type="checkbox"
                className="size-5 accent-blue-600"
                checked={Boolean(filters[option.key])}
                onChange={(event) => setFilters((current) => ({ ...current, [option.key]: event.target.checked }))}
              />
              {option.label}
              <span className="badge">{cards.filter((card) => cardMatchesStatus(card, option.key)).length}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="border-b border-slate-200 p-5">
        <label className="inline-flex items-center gap-2 text-lg font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-blue-600"
            checked={selectedDeckIds.length === decks.length && decks.length > 0}
            onChange={(event) => {
              const checked = event.target.checked;
              setSelectedDecks(Object.fromEntries(decks.map((deck) => [deck.id, checked])));
            }}
          />
          Subjects and Chapters
        </label>

        <div className="mt-6 grid gap-x-16 gap-y-3 sm:grid-cols-2">
          {deckCounts.map((deck) => (
            <label key={deck.id} className="inline-flex items-center gap-2 text-base text-slate-700">
              <input
                type="checkbox"
                className="size-5 accent-blue-600"
                checked={Boolean(selectedDecks[deck.id])}
                onChange={(event) => setSelectedDecks((current) => ({ ...current, [deck.id]: event.target.checked }))}
              />
              <span>{deck.name}</span>
              <span className="badge">{deck.matching}</span>
            </label>
          ))}
          {decks.length === 0 ? <p className="text-sm text-slate-500">Import a lesson before starting a session.</p> : null}
        </div>
      </section>

      <section className="grid gap-6 p-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="text-lg font-semibold">No. of Cards</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              className="field w-28"
              type="number"
              min={0}
              max={maxAllowed}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
            />
            <span className="text-slate-600">
              Max allowed in this selection <span className="badge">{maxAllowed}</span>
            </span>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Options</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <input type="checkbox" checked={shuffle} onChange={(event) => setShuffle(event.target.checked)} />
              <Shuffle size={16} />
              Shuffle cards
            </label>
            <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <input type="checkbox" checked={direction === "front-back"} onChange={() => setDirection("front-back")} />
              Front → Back mode
            </label>
            <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <input type="checkbox" checked={includeCorrect} onChange={(event) => setIncludeCorrect(event.target.checked)} />
              Include correct cards
            </label>
            <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <input type="checkbox" checked={includeOmitted} onChange={(event) => setIncludeOmitted(event.target.checked)} />
              Include omitted cards
            </label>
          </div>
        </div>

        <div className="lg:col-span-2">
          {error ? <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          <button className="btn btn-primary" disabled={loading || requestedCount === 0}>
            <CheckCircle2 size={17} />
            {loading ? "Starting..." : `Start ${requestedCount || 0} cards`}
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
        </form>
      ) : null}
    </div>
  );
}
