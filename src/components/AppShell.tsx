import Link from "next/link";
import { BookOpen, ClipboardList, Database, Home, Import, LineChart, LogOut, PlayCircle } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/import", label: "Import", icon: Import },
  { href: "/cards", label: "Card Bank", icon: Database },
  { href: "/study", label: "Study", icon: PlayCircle },
  { href: "/study/history", label: "Past Tests", icon: ClipboardList },
  { href: "/stats", label: "Stats", icon: LineChart },
];

export function AppShell({ children, email }: { children: React.ReactNode; email?: string | null }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_18%,#eef2ff_0,transparent_34%),radial-gradient(circle_at_82%_24%,#dcfce7_0,transparent_30%),#fbfcff] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/86 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white">
              <BookOpen size={19} />
            </span>
            Korean Memory
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href} className="nav-link" title={link.label}>
                  <Icon size={16} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
            <a href="/api/auth/logout" className="nav-link" title={email ? `Sign out ${email}` : "Sign out"}>
              <LogOut size={16} />
              <span>Sign out</span>
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
