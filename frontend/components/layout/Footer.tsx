import { Spade } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-poker-green/20 border border-poker-green/30">
              <Spade className="h-3.5 w-3.5 text-poker-green" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Stacked<span className="text-poker-green"> Poker</span>
            </span>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Educational tool only. Not a replacement for a real GTO solver.
            For training purposes only.
          </p>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Stacked Poker
          </p>
        </div>
      </div>
    </footer>
  );
}
