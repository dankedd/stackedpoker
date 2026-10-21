import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, MailX } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { setOptOutByToken } from "@/lib/lifecycle/optOut";
import { UNSUBSCRIBE } from "@/lib/lifecycle/strings";

/**
 * The unsubscribe link in every lifecycle email. Opening it unsubscribes —
 * one click, no login (the signed token says who). "Resubscribe" undoes it.
 */

export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function resubscribe(formData: FormData) {
  "use server";
  const t = String(formData.get("t") ?? "");
  const ok = await setOptOutByToken(t, false);
  redirect(ok ? `/unsubscribe?done=resubscribed` : `/unsubscribe`);
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; done?: string }>;
}) {
  const { t, done } = await searchParams;

  let state: "unsubscribed" | "resubscribed" | "invalid";
  if (done === "resubscribed") state = "resubscribed";
  else {
    let ok = false;
    try {
      ok = await setOptOutByToken(t, true);
    } catch {
      ok = false;
    }
    state = ok ? "unsubscribed" : "invalid";
  }

  const copy = {
    unsubscribed: { title: UNSUBSCRIBE.doneTitle, body: UNSUBSCRIBE.doneBody },
    resubscribed: { title: UNSUBSCRIBE.resubscribedTitle, body: UNSUBSCRIBE.resubscribedBody },
    invalid: { title: UNSUBSCRIBE.invalidTitle, body: UNSUBSCRIBE.invalidBody },
  }[state];

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-6 sm:p-8">
          {state === "invalid" ? (
            <MailX aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="h-8 w-8 text-emerald-400" />
          )}
          <h1 className="mt-4 text-xl font-bold text-foreground">{copy.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.body}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {state === "unsubscribed" && (
              <form action={resubscribe}>
                <input type="hidden" name="t" value={t ?? ""} />
                <button
                  type="submit"
                  className="h-10 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
                >
                  {UNSUBSCRIBE.resubscribe}
                </button>
              </form>
            )}
            <Link href={state === "invalid" ? "/settings" : "/"} className="text-sm font-medium text-violet-300 underline-offset-4 hover:underline">
              {state === "invalid" ? UNSUBSCRIBE.toSettings : UNSUBSCRIBE.home}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
