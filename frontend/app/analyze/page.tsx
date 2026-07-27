import { Spade } from "lucide-react";
import { DevelopmentPage } from "@/components/dev/DevelopmentPage";

export default function AnalyzeHubPage() {
  return (
    <DevelopmentPage
      icon={Spade}
      status="development"
      title="AI Hand Analysis"
      description="Analyze your own hands with strategy-backed AI coaching."
      note="We're rebuilding analysis around a reliable strategy foundation before making it available."
    />
  );
}
