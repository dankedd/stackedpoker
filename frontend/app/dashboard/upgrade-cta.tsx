"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpgradeCTA() {
  return (
    <Button variant="poker" size="sm" className="gap-2 shrink-0" asChild>
      <Link href="/pricing">
        <Zap className="h-3.5 w-3.5" />
        Upgrade to Pro
      </Link>
    </Button>
  );
}
