import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_18%_18%,#eef2ff_0,transparent_34%),radial-gradient(circle_at_82%_24%,#dcfce7_0,transparent_30%),#fbfcff] px-4">
      <section className="panel w-full max-w-md rounded-3xl p-8">
        <div className="mb-7">
          <p className="text-sm font-semibold text-blue-600">Korean Memory</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your vocabulary database stays behind this single-user password.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
