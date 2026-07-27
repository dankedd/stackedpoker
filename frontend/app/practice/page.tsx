import { Puzzle } from "lucide-react";
import { DevelopmentPage } from "@/components/dev/DevelopmentPage";

export default function PracticePage() {
  return (
    <DevelopmentPage
      icon={Puzzle}
      status="next"
      title="Practice"
      description="Turn concepts into instinct with strategy-backed training — GTO decision drills, range exercises, board reading, and adaptive repetition."
      note="Practice is the next thing we're building on Stacked, using the same verified strategy foundation as Learn."
    />
  );
}
