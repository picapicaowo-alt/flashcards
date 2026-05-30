import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell email={user.email}>{children}</AppShell>;
}
