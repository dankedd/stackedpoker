import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HandReplayer } from "@/components/hand-history/HandReplayer";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function HandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  return (
    <Suspense>
      <HandReplayer id={id} />
    </Suspense>
  );
}
