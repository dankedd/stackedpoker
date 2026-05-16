import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { ProfileDashboard } from "./ProfileDashboard";

export const metadata = {
  title: "Player Profile | Stacked Poker",
  description: "Your personalised coaching profile — leaks, stats, and AI-powered study plan.",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />
      <ProfileDashboard accessToken={session.access_token} />
    </div>
  );
}
