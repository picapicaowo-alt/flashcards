"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileInput, Search } from "lucide-react";
import { parseMarkdownTable } from "@/lib/markdown-table";

type DeckOption = {
  id: string;
  name: string;
};

const NEW_DECK_VALUE = "__new_deck__";

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

export function ImportLessonForm({ decks }: { decks: DeckOption[] }) {
  const [deckOptions, setDeckOptions] = useState(decks);
  const [destinationDeckId, setDestinationDeckId] = useState(NEW_DECK_VALUE);
  const [deckName, setDeckName] = useState("");
  const [lessonDate, setLessonDate] = useState(todayValue());
  const [tags, setTags] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const preview = useMemo(() => parseMarkdownTable(markdown), [markdown]);
  const selectedDeck = useMemo(
    () => deckOptions.find((deck) => deck.id === destinationDeckId) ?? null,
    [deckOptions, destinationDeckId],
  );
  const isNewDeck = destinationDeckId === NEW_DECK_VALUE;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isNewDeck && !selectedDeck) {
      setError("Choose an existing deck.");
      return;
    }

    const targetDeckName = selectedDeck?.name ?? deckName.trim();

    if (!targetDeckName) {
      setError("Deck name is required.");
      return;
    }

    if (preview.error) {
      setError(preview.error);
      return;
    }

    setLoading(true);
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deckId: selectedDeck?.id,
        deckName: isNewDeck ? targetDeckName : undefined,
        lessonDate: isNewDeck ? lessonDate : undefined,
        tags,
        markdown,
      }),
    });
    setLoading(false);

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Import failed.");
      return;
    }

    if (typeof body?.deckId === "string" && typeof body?.deckName === "string") {
      const importedDeck = { id: body.deckId, name: body.deckName };
      setDeckOptions((current) =>
        current.some((deck) => deck.id === importedDeck.id)
          ? current
          : [...current, importedDeck].sort((left, right) => left.name.localeCompare(right.name)),
      );
      setDestinationDeckId(importedDeck.id);
      setDeckName("");
    }

    setMessage(`Imported ${body.imported} card${body.imported === 1 ? "" : "s"} and skipped ${body.skipped} duplicate${body.skipped === 1 ? "" : "s"}.`);
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="panel rounded-3xl p-5">
        <div className="grid gap-4">
          <label>
            <span className="mb-1 block text-sm font-medium text-slate-600">Import destination</span>
            <select className="field" value={destinationDeckId} onChange={(event) => setDestinationDeckId(event.target.value)}>
              <option value={NEW_DECK_VALUE}>Create new deck</option>
              {deckOptions.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>
          </label>
          {isNewDeck ? (
            <>
              <label>
                <span className="mb-1 block text-sm font-medium text-slate-600">New deck / lesson name</span>
                <input className="field" value={deckName} onChange={(event) => setDeckName(event.target.value)} placeholder="Korean Week 1" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium text-slate-600">Date</span>
                <input className="field" type="date" value={lessonDate} onChange={(event) => setLessonDate(event.target.value)} />
              </label>
            </>
          ) : null}
          <label>
            <span className="mb-1 block text-sm font-medium text-slate-600">Tags</span>
            <input className="field" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="verbs, week-1, grammar" />
          </label>
          <button className="btn btn-primary" disabled={loading || preview.cards.length === 0}>
            <FileInput size={17} />
            {loading ? "Importing..." : "Import cards"}
          </button>
          {message ? (
            <p className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              <CheckCircle2 size={17} />
              {message}
            </p>
          ) : null}
          {error || preview.error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || preview.error}</p>
          ) : null}
        </div>
      </section>

      <section className="panel rounded-3xl p-5">
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-600">Markdown table</span>
          <textarea
            className="field min-h-80 font-mono text-sm leading-6"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            placeholder="| Front | Back |&#10;| --- | --- |&#10;| **to study** | **공부하 / gongbuha** → **공부하다 / gongbuhada** |"
          />
        </label>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2 font-semibold">
              <Search size={17} />
              Preview
            </div>
            <span className="badge">{preview.cards.length}</span>
          </div>
          <div className="max-h-96 overflow-auto">
            {preview.cards.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Valid rows will appear here before import.</p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Front</th>
                    <th className="px-4 py-3 font-semibold">Back</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.cards.map((card, index) => (
                    <tr key={`${card.front}-${index}`}>
                      <td className="w-1/3 px-4 py-3 align-top font-medium">{card.front}</td>
                      <td className="px-4 py-3 align-top text-slate-600">{card.back}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </form>
  );
}
