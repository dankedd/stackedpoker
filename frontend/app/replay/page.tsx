import { Film } from "lucide-react";
import { DevelopmentPage } from "@/components/dev/DevelopmentPage";

export default function ReplayPage() {
  return (
    <DevelopmentPage
      icon={Film}
      status="development"
      title="Hand Replay"
      description="Replay hands street by street with accurate actions, stacks, pots and decisions."
      note="Replay will return as part of Stacked's strategy-backed study system."
    />
  );
}
