import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { ModerationConsole } from "@/components/social/ModerationConsole";
import { MODERATION } from "@/lib/social/strings";

export const metadata: Metadata = { title: MODERATION.title, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Reports, hiding content and bans. Moderators and admins only (profiles.role). */
export default async function ModerationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/moderation");

  const { data: isMod } = await supabase.rpc("am_i_moderator");
  if (isMod !== true) notFound();
  const { data: me } = await supabase.rpc("my_social_profile");
  const isAdmin = (me as { role?: string } | null)?.role === "admin";

  return (
    <div className="min-h-dvh bg-background">
      <Navbar variant="static" />
      <main className="container mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold text-foreground">{MODERATION.title}</h1>
        <ModerationConsole isAdmin={isAdmin} />
      </main>
    </div>
  );
}
