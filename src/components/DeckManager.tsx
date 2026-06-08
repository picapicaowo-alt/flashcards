"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, Pencil, Search, Trash2, X } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { stripMarkdownLite } from "@/lib/markdown-table";

type DeckCard = {
  id: string;
  front: string;
  back: string;
  status: string;
  isMarked: boolean;
  isOmitted: boolean;
  correctCount: number;
  incorrectCount: number;
  reviewCount: number;
  createdAt: string;
  tags: string[];
};

export type ManagedDeck = {
  id: string;
  name: string;
  lessonDate: string | null;
  createdAt: string;
  updatedAt: string;
  cards: DeckCard[];
};

function statusCounts(cards: DeckCard[]) {
  return cards.reduce<Record<string, number>>((counts, card) => {
    counts[card.status] = (counts[card.status] ?? 0) + 1;
    return counts;
  }, {});
}

function reviewTotals(cards: DeckCard[]) {
  return cards.reduce(
    (totals, card) => ({
      correct: totals.correct + card.correctCount,
      incorrect: totals.incorrect + card.incorrectCount,
      reviews: totals.reviews + card.reviewCount,
      marked: totals.marked + (card.isMarked ? 1 : 0),
      omitted: totals.omitted + (card.isOmitted ? 1 : 0),
    }),
    { correct: 0, incorrect: 0, reviews: 0, marked: 0, omitted: 0 },
  );
}

export function DeckManager({ initialDecks }: { initialDecks: ManagedDeck[] }) {
  const [decks, setDecks] = useState(initialDecks);
  const [activeDeckId, setActiveDeckId] = useState(initialDecks[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<ManagedDeck | null>(null);
  const [draftName, setDraftName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const selectVisibleRef = useRef<HTMLInputElement>(null);

  const filteredDecks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return decks;
    return decks.filter((deck) => {
      const cardText = deck.cards.map((card) => `${card.front} ${card.back} ${card.tags.join(" ")}`).join(" ");
      return `${deck.name} ${cardText}`.toLowerCase().includes(needle);
    });
  }, [decks, query]);

  const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? filteredDecks[0] ?? decks[0] ?? null;
  const totalCards = decks.reduce((sum, deck) => sum + deck.cards.length, 0);
  const visibleSelectedCount = filteredDecks.filter((deck) => selectedIds.has(deck.id)).length;
  const allVisibleSelected = filteredDecks.length > 0 && visibleSelectedCount === filteredDecks.length;

  useEffect(() => {
    if (!selectVisibleRef.current) return;
    selectVisibleRef.current.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < filteredDecks.length;
  }, [filteredDecks.length, visibleSelectedCount]);

  function toggleDeckSelection(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function toggleVisibleSelection(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredDecks.forEach((deck) => {
        if (checked) {
          next.add(deck.id);
        } else {
          next.delete(deck.id);
        }
      });
      return next;
    });
  }

  function beginEdit(deck: ManagedDeck) {
    setError("");
    setMessage("");
    setEditing(deck);
    setDraftName(deck.name);
  }

  async function saveDeckName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const nextName = draftName.trim();
    if (!nextName) {
      setError("Deck name is required.");
      return;
    }

    setError("");
    setMessage("");

    const response = await fetch(`/api/decks/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Could not update deck.");
      return;
    }

    setDecks((current) =>
      current
        .map((deck) => (deck.id === editing.id ? { ...deck, name: body.deck.name, updatedAt: body.deck.updatedAt } : deck))
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
    setEditing(null);
    setMessage("Deck name updated.");
  }

  async function deleteDeck(deck: ManagedDeck) {
    if (!window.confirm(`Delete "${deck.name}" and all ${deck.cards.length} card${deck.cards.length === 1 ? "" : "s"} in it?`)) return;

    setError("");
    setMessage("");
    const response = await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Could not delete deck.");
      return;
    }

    setDecks((current) => current.filter((item) => item.id !== deck.id));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(deck.id);
      return next;
    });
    setActiveDeckId((current) => (current === deck.id ? "" : current));
    setMessage(`Deleted "${deck.name}".`);
  }

  async function deleteSelectedDecks() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const selectedDecks = decks.filter((deck) => selectedIds.has(deck.id));
    const selectedCardCount = selectedDecks.reduce((sum, deck) => sum + deck.cards.length, 0);
    if (!window.confirm(`Delete ${ids.length} selected deck${ids.length === 1 ? "" : "s"} and ${selectedCardCount} card${selectedCardCount === 1 ? "" : "s"}?`)) return;

    setError("");
    setMessage("");
    setIsDeletingSelected(true);
    try {
      const response = await fetch("/api/decks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not delete selected decks.");

      const deletedIds = new Set(ids);
      setDecks((current) => current.filter((deck) => !deletedIds.has(deck.id)));
      setSelectedIds(new Set());
      setActiveDeckId((current) => (deletedIds.has(current) ? "" : current));
      setMessage(`Deleted ${body?.deletedCount ?? ids.length} selected deck${ids.length === 1 ? "" : "s"}.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete selected decks.");
    } finally {
      setIsDeletingSelected(false);
    }
  }

  const counts = activeDeck ? statusCounts(activeDeck.cards) : {};
  const totals = activeDeck ? reviewTotals(activeDeck.cards) : { correct: 0, incorrect: 0, reviews: 0, marked: 0, omitted: 0 };

  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="panel rounded-3xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Decks</h2>
            <p className="mt-1 text-sm text-slate-500">
              {decks.length} deck{decks.length === 1 ? "" : "s"} · {totalCards} card{totalCards === 1 ? "" : "s"}
            </p>
          </div>
          {selectedIds.size > 0 ? (
            <button type="button" className="btn btn-red min-h-9 px-3" onClick={deleteSelectedDecks} disabled={isDeletingSelected}>
              <Trash2 size={15} />
              {isDeletingSelected ? "Deleting..." : `Delete ${selectedIds.size}`}
            </button>
          ) : null}
        </div>

        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input className="field pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search decks or cards" />
        </label>

        {message ? <p className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">
            <span>
              Showing {filteredDecks.length} of {decks.length}
              {selectedIds.size > 0 ? <span className="ml-2 text-blue-600">{selectedIds.size} selected</span> : null}
            </span>
            {selectedIds.size > 0 ? (
              <button type="button" className="btn min-h-8 px-3 text-sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </button>
            ) : null}
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      ref={selectVisibleRef}
                      type="checkbox"
                      className="h-4 w-4"
                      checked={allVisibleSelected}
                      disabled={filteredDecks.length === 0}
                      onChange={(event) => toggleVisibleSelection(event.target.checked)}
                      aria-label="Select all shown decks"
                    />
                  </th>
                  <th className="px-4 py-3">Deck</th>
                  <th className="px-4 py-3">Cards</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDecks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No decks found.
                    </td>
                  </tr>
                ) : (
                  filteredDecks.map((deck) => (
                    <tr key={deck.id} className={activeDeck?.id === deck.id ? "align-top bg-blue-50/45" : "align-top"}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selectedIds.has(deck.id)}
                          onChange={(event) => toggleDeckSelection(deck.id, event.target.checked)}
                          aria-label={`Select ${deck.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" className="text-left font-semibold text-slate-950 hover:text-blue-600" onClick={() => setActiveDeckId(deck.id)}>
                          {deck.name}
                        </button>
                        <p className="mt-1 text-xs text-slate-500">Created {formatDate(deck.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge">{deck.cards.length}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(deck.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn min-h-9 px-3" onClick={() => setActiveDeckId(deck.id)} title="View deck">
                            <Eye size={15} />
                          </button>
                          <button type="button" className="btn min-h-9 px-3" onClick={() => beginEdit(deck)} title="Edit deck name">
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="btn btn-red min-h-9 px-3" onClick={() => deleteDeck(deck)} title="Delete deck">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel rounded-3xl p-4 sm:p-5">
        {activeDeck ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-600">Deck Detail</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-normal">{activeDeck.name}</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Created {formatDate(activeDeck.createdAt)} · Updated {formatDate(activeDeck.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn min-h-9 px-3" onClick={() => beginEdit(activeDeck)}>
                  <Pencil size={15} />
                  Edit
                </button>
                <button type="button" className="btn btn-red min-h-9 px-3" onClick={() => deleteDeck(activeDeck)}>
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Cards</p>
                <p className="mt-2 text-2xl font-semibold">{activeDeck.cards.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Lesson date</p>
                <p className="mt-2 font-semibold">{formatDate(activeDeck.lessonDate)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Reviews</p>
                <p className="mt-2 text-2xl font-semibold">{totals.reviews}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Flags</p>
                <p className="mt-2 font-semibold">
                  {totals.marked} marked · {totals.omitted} omitted
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(counts).length === 0 ? (
                <span className="text-sm text-slate-500">No status counts yet.</span>
              ) : (
                Object.entries(counts).map(([status, count]) => (
                  <span key={status} className="badge">
                    {status}: {count}
                  </span>
                ))
              )}
              <span className="badge text-green-700">Correct {totals.correct}</span>
              <span className="badge text-red-700">Incorrect {totals.incorrect}</span>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h3 className="font-semibold">Cards in this deck</h3>
                <span className="badge">{activeDeck.cards.length}</span>
              </div>
              <div className="max-h-[36rem] overflow-auto">
                {activeDeck.cards.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">This deck has no cards.</p>
                ) : (
                  <table className="w-full min-w-[780px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Front</th>
                        <th className="px-4 py-3">Back</th>
                        <th className="px-4 py-3">Tags</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Counts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeDeck.cards.map((card) => (
                        <tr key={card.id} className="align-top">
                          <td className="max-w-xs px-4 py-3 font-semibold">{stripMarkdownLite(card.front)}</td>
                          <td className="max-w-md px-4 py-3 text-slate-600">{stripMarkdownLite(card.back)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {card.tags.length ? card.tags.map((tag) => <span key={tag} className="badge">{tag}</span>) : <span className="text-slate-400">None</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="badge">{card.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-green-600">{card.correctCount}</span>
                            <span className="px-1 text-slate-300">/</span>
                            <span className="text-red-600">{card.incorrectCount}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <div>
              <h2 className="text-xl font-semibold">No decks yet</h2>
              <p className="mt-2 text-sm text-slate-500">Import a Markdown table to create your first deck.</p>
            </div>
          </div>
        )}
      </section>

      {editing ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <form onSubmit={saveDeckName} className="panel w-full max-w-xl rounded-3xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit deck name</h2>
              <button type="button" className="btn min-h-9 px-3" onClick={() => setEditing(null)} title="Close">
                <X size={16} />
              </button>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">Deck name</span>
              <input className="field" value={draftName} onChange={(event) => setDraftName(event.target.value)} autoFocus />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                <X size={16} />
                Cancel
              </button>
              <button className="btn btn-primary">
                <Check size={16} />
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
