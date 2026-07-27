import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StatusBadge, type ProductStatus } from "@/components/layout/StatusBadge";

interface DevelopmentPageProps {
  icon: LucideIcon;
  status: ProductStatus;
  title: string;
  description: string;
  note?: string;
}

export function DevelopmentPage({ icon: Icon, status, title, description, note }: DevelopmentPageProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-lg rounded-3xl border border-border/50 bg-card/60 p-10 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/40 border border-border/50">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>

          <div className="mb-4 flex justify-center">
            <StatusBadge status={status} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
            {title}
          </h1>
          <p className="text-muted-foreground leading-relaxed mb-2">{description}</p>
          {note && (
            <p className="text-sm text-muted-foreground/70 leading-relaxed">{note}</p>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/learn"
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/45 hover:-translate-y-0.5 transition-all duration-200"
            >
              Go to Learn
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl border border-border/50 bg-card/40 text-foreground text-sm font-medium hover:bg-card/60 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
