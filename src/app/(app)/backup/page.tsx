import { BackupPanel } from "@/components/BackupPanel";

export const dynamic = "force-dynamic";

export default function BackupPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-blue-600">Backup</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal">Export or restore your study database</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          JSON backups include decks, cards, tags, review logs, and study sessions. Duplicate cards are skipped on import.
        </p>
      </div>
      <BackupPanel />
    </div>
  );
}
