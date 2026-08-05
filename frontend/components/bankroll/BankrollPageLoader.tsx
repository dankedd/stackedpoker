import { Loader2 } from "lucide-react";

/** Full-page spinner shown while auth/initial data is resolving. Extracted since it was duplicated identically across 5 client-rendered /bankroll/* pages. */
export function BankrollPageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
    </div>
  );
}
