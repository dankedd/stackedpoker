"use client";

import { useState } from "react";
import { ClipboardPaste, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface HandInputProps {
  onAnalyze: (text: string) => void;
  isLoading: boolean;
  className?: string;
  initialValue?: string;
}

const PLACEHOLDER = `Paste your hand history here...

Example (GGPoker):
Poker Hand #RC0123456789: Hold'em No Limit ($0.50/$1.00) - 2024/01/15 14:22:33
Table 'FastForward' 6-Max Seat #3 is the button
Seat 1: Player1 ($112.30 in chips)
Seat 2: Player2 ($100.00 in chips)
Seat 3: Hero ($87.50 in chips)
...`;

export function HandInput({ onAnalyze, isLoading, className, initialValue }: HandInputProps) {
  const [text, setText] = useState(initialValue ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length >= 50) {
      onAnalyze(text.trim());
    }
  };

  const handlePaste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setText(t);
    } catch {
      // clipboard access denied — user can paste manually
    }
  };

  const isEmpty = text.trim().length < 50;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          className="min-h-[220px] border-border/70 bg-card/50 text-xs sm:text-sm focus:border-violet-500/50 focus:ring-violet-500/30 resize-y"
          disabled={isLoading}
        />

        {text && (
          <button
            type="button"
            onClick={() => setText("")}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            title="Clear"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePaste}
          disabled={isLoading}
          className="gap-2"
        >
          <ClipboardPaste className="h-4 w-4" />
          Paste from Clipboard
        </Button>

        <Button
          type="submit"
          variant="poker"
          size="sm"
          disabled={isEmpty || isLoading}
          className="sm:ml-auto gap-2 min-w-[140px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            "Analyze Hand"
          )}
        </Button>
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className={cn("flex items-center gap-1", !isEmpty && "text-violet-400/70")}>
          <span className={cn("h-1.5 w-1.5 rounded-full bg-current")} />
          GGPoker
        </span>
        <span className={cn("flex items-center gap-1", !isEmpty && "text-violet-400/70")}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          PokerStars
        </span>
      </div>
    </form>
  );
}
