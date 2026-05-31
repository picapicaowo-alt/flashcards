export function StatCard({
  label,
  value,
  tone = "blue",
  delta,
}: {
  label: string;
  value: string | number;
  tone?: "blue" | "green" | "red" | "slate";
  delta?: {
    label: string;
    tone?: "green" | "red" | "slate";
  };
}) {
  const tones = {
    blue: "border-blue-100 bg-blue-50/70 text-blue-700",
    green: "border-green-100 bg-green-50/70 text-green-700",
    red: "border-red-100 bg-red-50/70 text-red-700",
    slate: "border-slate-200 bg-white/78 text-slate-700",
  };
  const deltaTones = {
    green: "border-green-100 bg-green-50 text-green-700",
    red: "border-red-100 bg-red-50 text-red-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <p className="text-3xl font-semibold tracking-normal text-slate-950">{value}</p>
        {delta ? (
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${deltaTones[delta.tone ?? "slate"]}`}>
            {delta.label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
