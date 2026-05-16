import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { ProfileDashboard } from "./ProfileDashboard";
import { ComingSoonProfile } from "./ComingSoonProfile";

export const metadata = {
  title: "Player Profile | Stacked Poker",
  description: "Your personalised coaching profile — leaks, stats, and AI-powered study plan.",
};

export default async function ProfilePage() {
  const supabase = await createClient();

  // Verify session server-side — redirect unauthenticated users
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Fetch subscription_tier from profiles table (server-side, not client-exposed)
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", session.user.id)
    .single();

  const isAdmin = profile?.subscription_tier === "admin";

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />
      {isAdmin
        ? <ProfileDashboard accessToken={session.access_token} />
        : <ComingSoonProfile />
      }
    </div>
  );
}
