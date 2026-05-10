"use client";

import { SkipBack, ChevronLeft, ChevronRight, SkipForward, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ControlsProps {
  isPlaying: boolean;
  isFirst: boolean;
  isLast: boolean;
  totalSteps: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReset: () => void;
  onSkipEnd: () => void;
}

export function Controls({
  isPlaying, isFirst, isLast, totalSteps,
  onPlay, onPause, onNext, onPrev, onReset, onSkipEnd,
}: ControlsProps) {
  return (
    <div className="flex items-center justify-center gap-1">
      {/* Skip to start */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onReset}
        disabled={isFirst}
        title="Back to start"
      >
        <SkipBack className="h-4 w-4" />
      </Button>

      {/* Previous */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onPrev}
        disabled={isFirst}
        title="Previous action"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Play / Pause */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "h-10 w-10 rounded-full border-2 transition-all",
          isPlaying
            ? "border-poker-green/60 bg-poker-green/10 text-poker-green"
            : "border-border hover:border-poker-green/40"
        )}
        onClick={isPlaying ? onPause : onPlay}
        disabled={isLast && !isPlaying}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </Button>

      {/* Next */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onNext}
        disabled={isLast}
        title="Next action"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Skip to end */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onSkipEnd}
        disabled={isLast}
        title="Skip to end"
      >
        <SkipForward className="h-4 w-4" />
      </Button>
    </div>
  );
}
