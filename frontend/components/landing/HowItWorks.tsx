import Link from "next/link";
import { ClipboardPaste, Cpu, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: "01",
    icon: ClipboardPaste,
    title: "Paste Your Hand",
    description:
      "Copy your hand history from GGPoker or PokerStars and paste it into the input field. We support all standard formats.",
  },
  {
    number: "02",
    icon: Cpu,
    title: "Instant Analysis",
    description:
      "Our engine parses the hand, classifies the spot, evaluates board texture, and runs heuristic rules based on GTO theory.",
  },
  {
    number: "03",
    icon: MessageSquare,
    title: "AI Coaching",
    description:
      "Receive personalized coaching that explains the range dynamics, board texture, and exact adjustments you should make.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-felt-pattern">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            How It <span className="text-poker-green">Works</span>
          </h2>
          <p className="text-muted-foreground">
            Three steps from hand history to expert coaching.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-1/2 w-full h-px bg-gradient-to-r from-poker-green/30 to-transparent" />
              )}

              <div className="relative z-10 mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-poker-green/30 bg-poker-green/10">
                <step.icon className="h-8 w-8 text-poker-green" />
                <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-poker-green text-black text-xs font-bold">
                  {index + 1}
                </div>
              </div>

              <h3 className="mb-3 text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Button variant="poker" size="lg" asChild>
            <Link href="/analyze">
              Try It Now — Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
