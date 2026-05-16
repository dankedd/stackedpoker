import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  FileText, AlertTriangle, CreditCard, Ban, User,
  ShieldAlert, Brain, Copyright, Scale, Mail,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — Stacked Poker",
  description:
    "Terms governing your use of Stacked Poker — an educational poker analysis and coaching platform.",
};

const LAST_UPDATED = "May 14, 2026";

const SECTIONS = [
  { id: "acceptance",      num: "01", title: "Acceptance of Terms" },
  { id: "disclaimer",      num: "02", title: "Educational Use Disclaimer" },
  { id: "account",         num: "03", title: "Account Registration" },
  { id: "subscriptions",   num: "04", title: "Subscription Plans & Billing" },
  { id: "cancellation",    num: "05", title: "Cancellation & Refunds" },
  { id: "acceptable-use",  num: "06", title: "Acceptable Use" },
  { id: "ai-disclaimer",   num: "07", title: "AI Analysis Disclaimer" },
  { id: "fair-usage",      num: "08", title: "Fair Usage & Plan Limits" },
  { id: "ip",              num: "09", title: "Intellectual Property" },
  { id: "liability",       num: "10", title: "Limitation of Liability" },
  { id: "termination",     num: "11", title: "Account Termination" },
  { id: "governing-law",   num: "12", title: "Governing Law" },
  { id: "changes",         num: "13", title: "Changes to These Terms" },
  { id: "contact",         num: "14", title: "Contact Us" },
];

function SectionHeader({
  id,
  num,
  title,
  icon: Icon,
}: {
  id: string;
  num: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div id={id} className="flex items-center gap-3 mb-5 pb-4 border-b border-border/40">
      {Icon && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Icon className="h-4 w-4 text-violet-400" />
        </div>
      )}
      <div className="flex items-baseline gap-2.5">
        <span className="text-[11px] font-mono text-violet-400/50 tabular-nums">{num}</span>
        <h2 className="text-[18px] font-bold text-foreground tracking-tight">{title}</h2>
      </div>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 text-[15px] text-muted-foreground/80 leading-[1.75]">
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="ml-1 space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[14px] text-muted-foreground/75 leading-relaxed">
          <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-violet-400/40 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function WarningCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/6 px-4 py-3.5 flex gap-3">
      <AlertTriangle className="h-4 w-4 text-amber-400/70 shrink-0 mt-0.5" />
      <p className="text-[14px] text-muted-foreground/80 leading-relaxed">{children}</p>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/6 px-4 py-3.5 text-[14px] text-muted-foreground/80 leading-relaxed">
      {children}
    </div>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      {/* Hero header */}
      <div className="border-b border-border/40 bg-card/20">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 pt-14 pb-10">
          <div className="flex items-center gap-2 mb-4 text-[12px] text-muted-foreground/50">
            <Link href="/" className="hover:text-muted-foreground transition-colors">Home</Link>
            <span>/</span>
            <span>Terms of Service</span>
          </div>
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/80 mb-2">Legal</p>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground mb-3">
                Terms of Service
              </h1>
              <p className="text-muted-foreground/60 text-sm">
                Last updated: <span className="text-muted-foreground/80">{LAST_UPDATED}</span>
              </p>
            </div>
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20">
              <FileText className="h-6 w-6 text-violet-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-12 lg:py-16">
        <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-14">

          {/* Sticky table of contents — desktop */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground/40 mb-3 font-semibold">Contents</p>
              <nav className="space-y-0.5">
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-[12px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-card/60 transition-colors duration-150"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground/30 w-5 shrink-0">{s.num}</span>
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="space-y-12 min-w-0">

            {/* Key summary card */}
            <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground/50">Key Points</p>
              <div className="space-y-2.5">
                {[
                  "Stacked Poker is an educational tool — not a gambling service.",
                  "AI analysis may contain errors. Do not rely on it as professional advice.",
                  "Subscriptions auto-renew monthly. Cancel anytime from settings.",
                  "You are responsible for keeping your account credentials secure.",
                ].map((point, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-[11px] font-mono text-violet-400/50 mt-0.5 shrink-0 w-4">{String(i + 1).padStart(2, "0")}</span>
                    <p className="text-[13px] text-muted-foreground/70 leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 01 Acceptance */}
            <section>
              <SectionHeader id="acceptance" num="01" title="Acceptance of Terms" icon={FileText} />
              <Prose>
                <p>
                  By accessing or using Stacked Poker (&ldquo;the Service&rdquo;), you agree to be bound by these
                  Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, please do not use the Service.
                </p>
                <p>
                  These Terms constitute a legally binding agreement between you and Stacked Poker. They
                  apply to all visitors, users, and others who access the Service.
                </p>
                <p>
                  You must be at least <strong className="text-foreground/80">18 years old</strong> to use Stacked Poker.
                  By using the Service, you represent that you meet this requirement.
                </p>
              </Prose>
            </section>

            {/* 02 Disclaimer */}
            <section>
              <SectionHeader id="disclaimer" num="02" title="Educational Use Disclaimer" icon={AlertTriangle} />
              <WarningCallout>
                <strong className="text-foreground/80">Stacked Poker is strictly an educational tool.</strong>{" "}
                It is designed to help poker players study and improve their game through analysis and coaching.
              </WarningCallout>
              <div className="mt-5">
                <Prose>
                  <p>Stacked Poker is <strong className="text-foreground/80">not</strong>:</p>
                  <BulletList items={[
                    "A gambling platform, casino, or betting service",
                    "A replacement for professional GTO solver software (e.g., GTO+, Solver HUD, PioSOLVER)",
                    "A guarantee of improved results or win rate at the poker table",
                    "Professional coaching or financial advice",
                    "Affiliated with, endorsed by, or approved by any poker room or casino",
                  ]} />
                  <p className="mt-2">
                    The platform is intended for study and review of past hands. Any poker decisions you
                    make at real-money tables remain your own responsibility.
                  </p>
                </Prose>
              </div>
            </section>

            {/* 03 Account Registration */}
            <section>
              <SectionHeader id="account" num="03" title="Account Registration" icon={User} />
              <Prose>
                <p>
                  To access most features, you must create an account. By registering, you agree to:
                </p>
                <BulletList items={[
                  "Provide accurate, current, and complete registration information",
                  "Maintain and update your information to keep it accurate",
                  "Keep your password secure and not share your account with others",
                  "Notify us immediately at legal@stacked.ai if you suspect unauthorized account access",
                  "Accept responsibility for all activity that occurs under your account",
                ]} />
                <p className="mt-2">
                  We reserve the right to refuse registration or terminate accounts at our discretion,
                  particularly if we determine that information provided is false or misleading.
                </p>
              </Prose>
            </section>

            {/* 04 Subscriptions & Billing */}
            <section>
              <SectionHeader id="subscriptions" num="04" title="Subscription Plans & Billing" icon={CreditCard} />
              <Prose>
                <p>Stacked Poker offers the following plans:</p>
                <div className="grid sm:grid-cols-2 gap-3 mt-1 mb-4">
                  <div className="rounded-xl border border-border/40 bg-card/40 p-4">
                    <p className="text-[13px] font-semibold text-foreground mb-2">Free Plan</p>
                    <BulletList items={[
                      "3 hand analyses included",
                      "Access to core analysis features",
                      "No credit card required",
                    ]} />
                  </div>
                  <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
                    <p className="text-[13px] font-semibold text-violet-300 mb-2">Pro Plan — €14.99/month</p>
                    <BulletList items={[
                      "Advanced analysis & AI coaching",
                      "Extended replay tools",
                      "Expanded puzzle access",
                      "Leak detection & training history",
                    ]} />
                  </div>
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                    <p className="text-[13px] font-semibold text-amber-300 mb-2">Premium Plan — €34.99/month</p>
                    <BulletList items={[
                      "Everything in Pro",
                      "Advanced solver-backed analysis",
                      "Premium coaching & leak intelligence",
                      "Priority features & premium study systems",
                    ]} />
                  </div>
                </div>
                <p>
                  Paid subscriptions are billed monthly in advance. By subscribing, you authorize us to
                  charge your payment method on a recurring basis until you cancel.
                </p>
                <p>
                  Prices are listed in EUR (€) and are exclusive of any applicable taxes. We may adjust
                  pricing with at least <strong className="text-foreground/80">30 days&apos; notice</strong> to existing subscribers.
                </p>
              </Prose>
            </section>

            {/* 05 Cancellation & Refunds */}
            <section>
              <SectionHeader id="cancellation" num="05" title="Cancellation & Refunds" />
              <Prose>
                <p>
                  You may cancel your Pro subscription at any time from your account settings or by
                  contacting us at <a href="mailto:legal@stacked.ai" className="text-violet-400 hover:text-violet-300 transition-colors">legal@stacked.ai</a>.
                </p>
                <BulletList items={[
                  "Cancellation takes effect at the end of the current billing period",
                  "You retain Pro access for the remainder of the paid period after cancellation",
                  "We do not offer prorated refunds for partial billing periods",
                  "If you believe you were charged in error, contact us within 30 days of the charge",
                ]} />
                <Callout>
                  <strong className="text-foreground/80">Exception:</strong> If this is your first charge and you contact us
                  within 7 days of initial subscription, we may issue a full refund at our discretion.
                </Callout>
              </Prose>
            </section>

            {/* 06 Acceptable Use */}
            <section>
              <SectionHeader id="acceptable-use" num="06" title="Acceptable Use" icon={Ban} />
              <Prose>
                <p>You agree to use Stacked Poker only for lawful purposes. You must not:</p>
                <BulletList items={[
                  "Upload hand histories containing private player data without appropriate consent",
                  "Attempt to reverse-engineer, decompile, or extract source code from the platform",
                  "Use automated bots, scrapers, or scripts to access the platform in bulk",
                  "Share, sell, or transfer your account to another person",
                  "Use the platform in any way that could damage, disable, or overburden our servers",
                  "Upload content that is illegal, harmful, or violates third-party rights",
                  "Circumvent account limits or access controls (e.g., creating multiple free accounts)",
                  "Use the Service to violate any applicable laws or regulations",
                ]} />
                <p className="mt-2">
                  Violations may result in immediate account suspension or termination without refund.
                </p>
              </Prose>
            </section>

            {/* 07 AI Disclaimer */}
            <section>
              <SectionHeader id="ai-disclaimer" num="07" title="AI Analysis Disclaimer" icon={Brain} />
              <WarningCallout>
                AI-generated coaching insights may contain errors, incomplete reasoning, or advice that is
                suboptimal for specific situations. They do not replace professional poker coaching or
                dedicated solver software.
              </WarningCallout>
              <div className="mt-5">
                <Prose>
                  <p>
                    Our analysis engine uses a combination of rule-based GTO heuristics and large language
                    model (LLM) output via Anthropic&apos;s Claude API. You acknowledge that:
                  </p>
                  <BulletList items={[
                    "Analysis results represent general strategic patterns, not exact GTO solutions",
                    "AI coaching text may occasionally be incorrect, hallucinated, or misleading",
                    "Results should be treated as a starting point for study, not a definitive answer",
                    "We make no guarantee of accuracy for any specific spot or hand",
                    "Applying analysis results at the table is done entirely at your own risk",
                  ]} />
                </Prose>
              </div>
            </section>

            {/* 08 Fair Usage */}
            <section>
              <SectionHeader id="fair-usage" num="08" title="Fair Usage & Plan Limits" />
              <Prose>
                <p>
                  All plans include usage limits designed to ensure a quality experience for all users:
                </p>
                <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-3 mt-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground/70">Free plan analyses</span>
                    <span className="font-mono text-foreground/80">3 total</span>
                  </div>
                  <div className="h-px bg-border/40" />
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground/70">Pro plan analyses</span>
                    <span className="font-mono text-foreground/80">Unlimited (fair use)</span>
                  </div>
                  <div className="h-px bg-border/40" />
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground/70">API rate limiting</span>
                    <span className="font-mono text-foreground/80">Applied to all plans</span>
                  </div>
                </div>
                <p className="mt-2">
                  &ldquo;Unlimited&rdquo; on the Pro plan is subject to fair use. Accounts showing automated or
                  bulk usage patterns inconsistent with personal study may be limited or suspended.
                  We will contact you before taking such action.
                </p>
              </Prose>
            </section>

            {/* 09 Intellectual Property */}
            <section>
              <SectionHeader id="ip" num="09" title="Intellectual Property" icon={Copyright} />
              <Prose>
                <p>
                  <strong className="text-foreground/80">Your content:</strong> You retain full ownership of any hand
                  histories, files, or other data you upload to Stacked Poker. By uploading, you grant us
                  a limited, non-exclusive license to process and store this data solely to provide the Service.
                </p>
                <p>
                  <strong className="text-foreground/80">Our content:</strong> The Stacked Poker platform, including its
                  design, code, trademarks, analysis engine, and generated coaching content, is owned by
                  Stacked Poker and protected by intellectual property laws. You may not copy, reproduce,
                  or redistribute any part of our platform without written permission.
                </p>
              </Prose>
            </section>

            {/* 10 Limitation of Liability */}
            <section>
              <SectionHeader id="liability" num="10" title="Limitation of Liability" icon={ShieldAlert} />
              <Prose>
                <p>
                  To the maximum extent permitted by applicable law, Stacked Poker and its team shall
                  not be liable for:
                </p>
                <BulletList items={[
                  "Financial losses incurred from poker decisions based on platform analysis",
                  "Loss of data, profits, or revenue arising from use of the Service",
                  "Service interruptions, bugs, or technical failures",
                  "Indirect, incidental, special, punitive, or consequential damages",
                  "Actions of third-party services integrated into the platform",
                ]} />
                <div className="rounded-xl border border-border/50 bg-card/40 px-4 py-3.5 mt-4">
                  <p className="text-[14px] text-muted-foreground/75 leading-relaxed">
                    Our total cumulative liability to you for any claim arising from or related to the
                    Service shall not exceed the amount you paid us in the{" "}
                    <strong className="text-foreground/80">30 days immediately preceding the claim</strong>.
                  </p>
                </div>
                <p>
                  Some jurisdictions do not allow certain liability exclusions. In those jurisdictions,
                  our liability is limited to the maximum extent permitted by law.
                </p>
              </Prose>
            </section>

            {/* 11 Termination */}
            <section>
              <SectionHeader id="termination" num="11" title="Account Termination" />
              <Prose>
                <p>
                  <strong className="text-foreground/80">By you:</strong> You may delete your account at any time
                  from the account settings page. Deletion is permanent and removes your data per our
                  Privacy Policy.
                </p>
                <p>
                  <strong className="text-foreground/80">By us:</strong> We reserve the right to suspend or
                  terminate your account immediately, without prior notice, if you:
                </p>
                <BulletList items={[
                  "Violate these Terms of Service",
                  "Engage in fraudulent, abusive, or illegal activity",
                  "Attempt to circumvent technical controls or billing systems",
                ]} />
                <p className="mt-2">
                  Upon termination, your right to use the Service ceases immediately. Termination for
                  cause does not entitle you to a refund.
                </p>
              </Prose>
            </section>

            {/* 12 Governing Law */}
            <section>
              <SectionHeader id="governing-law" num="12" title="Governing Law" icon={Scale} />
              <Prose>
                <p>
                  These Terms are governed by and construed in accordance with the laws of{" "}
                  <strong className="text-foreground/80">The Netherlands</strong>, without regard to
                  conflict of law provisions.
                </p>
                <p>
                  Any disputes arising from these Terms or your use of the Service shall be subject to
                  the exclusive jurisdiction of the competent courts in The Netherlands, unless otherwise
                  required by mandatory consumer protection laws in your jurisdiction.
                </p>
              </Prose>
            </section>

            {/* 13 Changes */}
            <section>
              <SectionHeader id="changes" num="13" title="Changes to These Terms" />
              <Prose>
                <p>
                  We may update these Terms at any time. For material changes, we will provide at least{" "}
                  <strong className="text-foreground/80">14 days&apos; notice</strong> via email before the new
                  terms take effect.
                </p>
                <p>
                  Continued use of the Service after the effective date of updated Terms constitutes
                  acceptance. If you do not agree to updated Terms, you must stop using the Service and
                  may cancel your account.
                </p>
              </Prose>
            </section>

            {/* 14 Contact */}
            <section>
              <SectionHeader id="contact" num="14" title="Contact Us" icon={Mail} />
              <div className="rounded-2xl border border-border/50 bg-card/50 p-6">
                <p className="text-[14px] text-muted-foreground/75 leading-relaxed mb-5">
                  For questions about these Terms, subscription issues, or legal matters:
                </p>
                <a href="mailto:legal@stacked.ai" className="flex items-center gap-3 group">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <Mail className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-[12px] text-muted-foreground/50 mb-0.5">Legal &amp; Terms</p>
                    <p className="text-[14px] font-medium text-violet-400 group-hover:text-violet-300 transition-colors">
                      legal@stacked.ai
                    </p>
                  </div>
                </a>
                <p className="text-[12px] text-muted-foreground/45 mt-5">
                  We aim to respond to all legal inquiries within 5 business days.
                </p>
              </div>
            </section>

            {/* Cross-link */}
            <div className="rounded-xl border border-border/40 bg-card/30 px-5 py-4 flex items-center justify-between">
              <p className="text-[13px] text-muted-foreground/60">
                Read how we handle and protect your personal data.
              </p>
              <Link
                href="/privacy"
                className="text-[13px] font-medium text-violet-400 hover:text-violet-300 transition-colors shrink-0 ml-4"
              >
                Privacy Policy →
              </Link>
            </div>

          </main>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
