import { ImportLessonForm } from "@/components/ImportLessonForm";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-blue-600">Import Lesson</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal">Paste a Markdown vocabulary table</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Each table row becomes one flashcard. The back side keeps Markdown, line breaks, arrows, hooks, Korean,
          romanization, examples, and notes intact.
        </p>
      </div>
      <ImportLessonForm />
    </div>
  );
}
