import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogImageResponse, sanitizeForOg } from "@/lib/seo/og";
import { BRAND, SITE_NAME } from "@/lib/seo/config";
import { loadShareAnonymously } from "@/lib/social/share/server";
import { cardFace, summarizeShare } from "@/lib/social/share/summary";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A poker hand shared on Stacked Poker";

/** Plain-text default: the built-in OG font has no emoji. */
const DEFAULT_QUESTION = "Call or fold?";

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Card({ card, w }: { card: string | null; w: number }) {
  const h = Math.round(w * 1.4);
  if (!card) {
    return (
      <div
        style={{
          display: "flex",
          width: w,
          height: h,
          borderRadius: 12,
          border: "3px solid rgba(255,255,255,0.18)",
          backgroundImage: "linear-gradient(135deg, #4c1d95, #1e3a8a)",
        }}
      />
    );
  }
  const f = cardFace(card);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: w,
        height: h,
        borderRadius: 12,
        backgroundColor: "#ffffff",
        color: f.color,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ display: "flex", fontSize: Math.round(w * 0.5), fontWeight: 700, lineHeight: 1 }}>{f.rank}</div>
      <div style={{ display: "flex", fontSize: Math.round(w * 0.42), lineHeight: 1 }}>{f.suit}</div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await loadShareAnonymously(slug);
  if (!share) {
    return ogImageResponse({ eyebrow: "Poker hand", title: "Replay the hand and vote: what would you do?" });
  }
  const s = summarizeShare(share.hand);
  const question = sanitizeForOg((share.question || DEFAULT_QUESTION).slice(0, 140));
  const board: (string | null)[] = [...s.board];
  while (board.length < 3) board.push(null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BRAND.background,
          backgroundImage: "radial-gradient(900px 500px at 12% -10%, rgba(124,92,255,0.30), transparent 60%)",
          padding: "48px 60px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: question.length > 70 ? 40 : 52, fontWeight: 700, color: BRAND.text, lineHeight: 1.15, maxWidth: 1080 }}>
          {question}
        </div>

        {/* Felt */}
        <div
          style={{
            display: "flex",
            flex: 1,
            marginTop: 28,
            borderRadius: 220,
            border: "10px solid #3b2a14",
            backgroundImage: "radial-gradient(ellipse at center, #14532d 0%, #0b2e1a 75%)",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 70px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <Card card={s.heroCards?.[0] ?? null} w={92} />
              <Card card={s.heroCards?.[1] ?? null} w={92} />
            </div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#ddd6fe" }}>
              {`Hero · ${s.position} · ${fmt(s.stackBb)} BB`}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", gap: 10 }}>
              {board.map((c, i) => (
                <Card key={i} card={c} w={76} />
              ))}
            </div>
            <div style={{ display: "flex", padding: "8px 22px", borderRadius: 999, backgroundColor: "rgba(0,0,0,0.45)", color: "#fde68a", fontSize: 32, fontWeight: 700 }}>
              {`Pot ${fmt(s.potBb)} BB`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundImage: `linear-gradient(135deg, ${BRAND.violet}, ${BRAND.blue})`,
                color: "#fff",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              ♠
            </div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: BRAND.text }}>{SITE_NAME}</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: BRAND.muted }}>{share.guess_mode ? "Vote, then see what happened" : "Replay the hand"}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
