"use client";

import { useMemo, useState } from "react";
import { Check, Download, EyeOff, Pencil, RotateCcw, Search, Star, Trash2, Upload, X } from "lucide-react";
import { formatDate, isDueToday, isOverdue } from "@/lib/dates";
import { stripMarkdownLite } from "@/lib/markdown-table";

export type BankCard = {
  id: string;
  front: string;
  back: string;
  deckId: string;
  deckName: string;
  tags: string[];
  status: string;
  isMarked: boolean;
  isOmitted: boolean;
  correctCount: number;
  incorrectCount: number;
  reviewCount: number;
  nextReviewAt: string | null;
  createdAt: string;
};

type DeckOption = { id: string; name: string };

const filterOptions = [
  { key: "unused", label: "Unused" },
  { key: "incorrect", label: "Incorrect" },
  { key: "correct", label: "Correct" },
  { key: "marked", label: "Marked" },
  { key: "omitted", label: "Omitted" },
  { key: "due", label: "Due today" },
  { key: "overdue", label: "Overdue" },
  { key: "recent", label: "Recently added" },
];

function matchesStatus(card: BankCard, key: string) {
  if (key === "unused") return card.status === "unused";
  if (key === "incorrect") return card.status === "incorrect";
  if (key === "correct") return card.status === "review" || card.status === "correct";
  if (key === "marked") return card.isMarked;
  if (key === "omitted") return card.isOmitted;
  if (key === "due") return isDueToday(card.nextReviewAt);
  if (key === "overdue") return isOverdue(card.nextReviewAt);
  if (key === "recent") return Date.now() - new Date(card.createdAt).getTime() < 1000 * 60 * 60 * 24 * 14;
  return true;
}

export function CardBank({ initialCards, decks, tags }: { initialCards: BankCard[]; decks: DeckOption[]; tags: string[] }) {
  const [cards, setCards] = useState(initialCards);
  const [query, setQuery] = useState("");
  const [deckId, setDeckId] = useState("");
  const [tag, setTag] = useState("");
  const [filters, setFilters] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<BankCard | null>(null);
  const [message, setMessage] = useState("");

  const filteredCards = useMemo(() => {
    const enabled = Object.entries(filters)
      .filter(([, value]) => value)
      .map(([key]) => key);
    const needle = query.trim().toLowerCase();

    return cards.filter((card) => {
      if (deckId && card.deckId !== deckId) return false;
      if (tag && !card.tags.includes(tag)) return false;
      if (needle) {
        const haystack = `${card.front} ${card.back} ${card.deckName} ${card.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (enabled.length > 0 && !enabled.some((key) => matchesStatus(card, key))) return false;
      return true;
    });
  }, [cards, deckId, filters, query, tag]);

  async function patchCard(id: string, patch: Record<string, unknown>) {
    const response = await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error ?? "Could not update card.");
    setCards((current) =>
      current.map((card) =>
        card.id === id
          ? {
              ...card,
              ...body.card,
            }
          : card,
      ),
    );
    return body.card as Partial<BankCard>;
  }

  async function deleteCard(id: string) {
    if (!window.confirm("Delete this card permanently?")) return;
    const response = await fetch(`/api/cards/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    setCards((current) => current.filter((card) => card.id !== id));
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const formData = new FormData(event.currentTarget);
    await patchCard(editing.id, {
      front: formData.get("front"),
      back: formData.get("back"),
    });
    setEditing(null);
    setMessage("Card updated.");
  }

  return (
    <section className="panel rounded-3xl p-4 sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input className="field pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search front, back, deck, or tags" />
        </label>
        <select className="field" value={deckId} onChange={(event) => setDeckId(event.target.value)}>
          <option value="">All decks</option>
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.name}
            </option>
          ))}
        </select>
        <select className="field" value={tag} onChange={(event) => setTag(event.target.value)}>
          <option value="">All tags</option>
          {tags.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <label key={option.key} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(filters[option.key])}
              onChange={(event) => setFilters((current) => ({ ...current, [option.key]: event.target.checked }))}
            />
            {option.label}
          </label>
        ))}
        <a href="/api/backup/export" className="btn ml-auto">
          <Download size={16} />
          Export JSON
        </a>
        <a href="/backup" className="btn">
          <Upload size={16} />
          Import JSON
        </a>
      </div>

      {message ? <p className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p> : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">
          Showing {filteredCards.length} of {cards.length}
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Front</th>
                <th className="px-4 py-3">Deck</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Counts</th>
                <th className="px-4 py-3">Next review</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCards.map((card) => (
                <tr key={card.id} className="align-top">
                  <td className="max-w-sm px-4 py-3">
                    <p className="font-semibold">{stripMarkdownLite(card.front)}</p>
                    <p className="mt-1 line-clamp-2 text-slate-500">{stripMarkdownLite(card.back)}</p>
                  </td>
                  <td className="px-4 py-3">{card.deckName}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {card.tags.length ? card.tags.map((item) => <span key={item} className="badge">{item}</span>) : <span className="text-slate-400">None</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-green-600">{card.correctCount}</span>
                    <span className="px-1 text-slate-300">/</span>
                    <span className="text-red-600">{card.incorrectCount}</span>
                    <span className="ml-2 text-slate-500">{card.reviewCount} reviews</span>
                  </td>
                  <td className="px-4 py-3">{formatDate(card.nextReviewAt)}</td>
                  <td className="px-4 py-3">
                    <span className="badge">{card.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {card.isMarked ? <Star size={16} className="fill-blue-500 text-blue-500" /> : null}
                      {card.isOmitted ? <EyeOff size={16} className="text-slate-400" /> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button className="btn min-h-9 px-3" onClick={() => setEditing(card)} title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button className="btn min-h-9 px-3" onClick={() => patchCard(card.id, { isMarked: !card.isMarked })} title="Mark">
                        <Star size={15} />
                      </button>
                      <button className="btn min-h-9 px-3" onClick={() => patchCard(card.id, { isOmitted: !card.isOmitted })} title="Omit">
                        <EyeOff size={15} />
                      </button>
                      <button className="btn min-h-9 px-3" onClick={() => patchCard(card.id, { resetProgress: true })} title="Reset progress">
                        <RotateCcw size={15} />
                      </button>
                      <button className="btn btn-red min-h-9 px-3" onClick={() => deleteCard(card.id)} title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <form onSubmit={saveEdit} className="panel w-full max-w-3xl rounded-3xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit card</h2>
              <button type="button" className="btn min-h-9 px-3" onClick={() => setEditing(null)}>
                <X size={16} />
              </button>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">Front</span>
              <input className="field" name="front" defaultValue={editing.front} />
            </label>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-600">Back</span>
              <textarea className="field min-h-60 font-mono text-sm leading-6" name="back" defaultValue={editing.back} />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setEditing(null)}>
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
    </section>
  );
}
