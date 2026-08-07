import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canAccessLesson } from "@/lib/entitlements";
import { LessonPageClient } from "@/components/learn/LessonPageClient";
import { LockedLessonCard } from "@/components/learn/LockedLessonCard";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
// The REAL curriculum — full `steps`/answer keys. Safe ONLY here: this file
// is a Server Component, so this import never reaches the client bundle.
// The interactive player (LessonPageClient) receives the resolved `lesson`
// as a prop instead of importing curriculum.ts itself. See
// scripts/generateCurriculumPublic.ts and the membership-system plan (Part 3).
import { LESSONS_BY_SLUG, MODULES_BY_SLUG, LEARNING_MODULES, LESSONS_BY_MODULE } from "@/lib/learn/curriculum";

interface LessonPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { slug } = await params;
  const lesson = LESSONS_BY_SLUG[slug];

  if (!lesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-xl font-bold text-foreground">Lesson not found</p>
          <p className="text-muted-foreground text-sm">
            We couldn&apos;t find the lesson &ldquo;{slug}&rdquo;.
          </p>
          <Link
            href="/learn"
            className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to learning hub
          </Link>
        </div>
      </div>
    );
  }

  // Belt-and-suspenders: middleware already blocks guests from every /learn
  // route, but a lesson's content must never depend on middleware alone —
  // see the membership-system plan's "server-side security" requirement.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/learn/lesson/${slug}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();
  const tier = profile?.subscription_tier ?? "free";

  const mod = MODULES_BY_SLUG[lesson.module_id];
  const moduleLessons = LESSONS_BY_MODULE[lesson.module_id] ?? [];
  const allowed = mod ? canAccessLesson(tier, mod, lesson, LEARNING_MODULES, moduleLessons) : false;

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar variant="static" />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <LockedLessonCard
            title={lesson.title}
            subtitle={lesson.subtitle}
            estimatedMin={lesson.estimated_min}
            xpReward={lesson.xp_reward}
            variant="full"
          />
        </main>
        <Footer />
      </div>
    );
  }

  return <LessonPageClient lesson={lesson} />;
}
