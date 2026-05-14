import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { Shield, Database, CreditCard, Lock, Cookie, Brain, Eye, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — Stacked Poker",
  description:
    "How Stacked Poker collects, uses, and protects your data. GDPR-friendly, transparent, and user-first.",
};

const LAST_UPDATED = "May 14, 2026";

const SECTIONS = [
  { id: "introduction",      num: "01", title: "Introduction" },
  { id: "information",       num: "02", title: "Information We Collect" },
  { id: "usage",             num: "03", title: "How We Use Your Data" },
  { id: "hand-data",         num: "04", title: "Hand History & Poker Data" },
  { id: "ai-processing",     num: "05", title: "AI Analysis Processing" },
  { id: "payments",          num: "06", title: "Payment Processing" },
  { id: "authentication",    num: "07", title: "Authentication & Security" },
  { id: "cookies",           num: "08", title: "Cookies & Local Storage" },
  { id: "retention",         num: "09", title: "Data Retention" },
  { id: "gdpr",              num: "10", title: "Your Rights (GDPR)" },
  { id: "third-parties",     num: "11", title: "Third-Party Services" },
  { id: "changes",           num: "12", title: "Changes to This Policy" },
  { id: "contact",           num: "13", title: "Contact Us" },
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

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/6 px-4 py-3.5 text-[14px] text-muted-foreground/80 leading-relaxed">
      {children}
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      {/* Hero header */}
      <div className="border-b border-border/40 bg-card/20">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 pt-14 pb-10">
          <div className="flex items-center gap-2 mb-4 text-[12px] text-muted-foreground/50">
            <Link href="/" className="hover:text-muted-foreground transition-colors">Home</Link>
            <span>/</span>
            <span>Privacy Policy</span>
          </div>
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/80 mb-2">Legal</p>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground mb-3">
                Privacy Policy
              </h1>
              <p className="text-muted-foreground/60 text-sm">
                Last updated: <span className="text-muted-foreground/80">{LAST_UPDATED}</span>
              </p>
            </div>
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20">
              <Shield className="h-6 w-6 text-violet-400" />
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

            {/* TL;DR summary card */}
            <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground/50">Summary</p>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { icon: Database, text: "You own your poker data. We use it only to power your analysis." },
                  { icon: CreditCard, text: "Payments processed securely by Stripe. We never see your card." },
                  { icon: Eye, text: "No advertising. No selling your data. No third-party tracking." },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary/80 border border-border/50 mt-0.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                    </div>
                    <p className="text-[13px] text-muted-foreground/70 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 01 Introduction */}
            <section>
              <SectionHeader id="introduction" num="01" title="Introduction" />
              <Prose>
                <p>
                  Stacked Poker (&ldquo;Stacked,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the Stacked Poker platform,
                  an educational poker analysis tool available at <strong className="text-foreground/80">stacked.ai</strong>.
                </p>
                <p>
                  This Privacy Policy describes how we collect, use, store, and protect information about you when you
                  use our website and services. By creating an account or using the platform, you consent to the
                  practices described in this policy.
                </p>
                <p>
                  If you have questions, you can reach us at any time at{" "}
                  <a href="mailto:privacy@stacked.ai" className="text-violet-400 hover:text-violet-300 transition-colors">
                    privacy@stacked.ai
                  </a>.
                </p>
              </Prose>
            </section>

            {/* 02 Information We Collect */}
            <section>
              <SectionHeader id="information" num="02" title="Information We Collect" icon={Database} />
              <Prose>
                <p>We collect the following categories of information:</p>
                <div className="space-y-4 mt-1">
                  <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-1.5">
                    <p className="text-[13px] font-semibold text-foreground">Account Information</p>
                    <BulletList items={[
                      "Email address and username when you sign up",
                      "Hashed password (we never store plain-text passwords)",
                      "Google account details if you use Google Sign-In",
                      "Subscription tier and billing status",
                    ]} />
                  </div>
                  <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-1.5">
                    <p className="text-[13px] font-semibold text-foreground">Usage Data</p>
                    <BulletList items={[
                      "Pages visited and features used within the platform",
                      "Session duration and interaction patterns",
                      "Browser type, device type, and operating system",
                      "IP address (used for security and fraud prevention)",
                    ]} />
                  </div>
                  <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-1.5">
                    <p className="text-[13px] font-semibold text-foreground">Poker Data</p>
                    <BulletList items={[
                      "Hand histories you upload or paste for analysis",
                      "Tournament files and session data you provide",
                      "Analysis results and coaching insights generated for your hands",
                    ]} />
                  </div>
                </div>
              </Prose>
            </section>

            {/* 03 How We Use Your Data */}
            <section>
              <SectionHeader id="usage" num="03" title="How We Use Your Data" />
              <Prose>
                <p>We use the information we collect to:</p>
                <BulletList items={[
                  "Provide, operate, and improve the Stacked Poker platform",
                  "Process your hand histories and generate coaching analysis",
                  "Manage your account, subscription, and billing",
                  "Send transactional emails (password resets, billing receipts, important notices)",
                  "Analyze aggregate, anonymized usage patterns to improve our features",
                  "Detect and prevent fraudulent or abusive activity",
                  "Comply with legal obligations",
                ]} />
                <p className="mt-4">
                  We do <strong className="text-foreground/80">not</strong> use your data for advertising,
                  sell it to third parties, or use it to profile you for non-platform purposes.
                </p>
              </Prose>
            </section>

            {/* 04 Hand History & Poker Data */}
            <section>
              <SectionHeader id="hand-data" num="04" title="Hand History & Poker Data" icon={Database} />
              <Callout>
                <strong className="text-foreground/80">You own your poker data.</strong> Hand histories you upload remain
                yours. We act as a data processor, not a data owner, for your poker hands.
              </Callout>
              <div className="mt-5">
                <Prose>
                  <p>Specifically, hand histories and poker data you provide:</p>
                  <BulletList items={[
                    "Are used solely to generate analysis results and coaching insights for your account",
                    "Are never sold, licensed, or disclosed to third parties for their own use",
                    "Are not used to train AI or machine learning models beyond powering your analysis",
                    "Are stored securely and associated only with your account",
                    "Can be deleted at any time by deleting your account or contacting us",
                  ]} />
                  <p className="mt-2">
                    Hand histories may contain usernames of other players at the table. We treat this
                    information with the same confidentiality as your own data.
                  </p>
                </Prose>
              </div>
            </section>

            {/* 05 AI Analysis Processing */}
            <section>
              <SectionHeader id="ai-processing" num="05" title="AI Analysis Processing" icon={Brain} />
              <Prose>
                <p>
                  Stacked Poker uses <strong className="text-foreground/80">Anthropic&apos;s Claude</strong> API to
                  generate coaching commentary and strategic explanations. When you request an analysis:
                </p>
                <BulletList items={[
                  "Your parsed hand data (not your raw file) is sent to Anthropic's API",
                  "Anthropic processes this data to generate coaching text",
                  "We do not include your name, email, or account ID in API requests",
                  "Anthropic's data retention and usage is governed by their own privacy policy",
                ]} />
                <p className="mt-2">
                  Anthropic is a SOC 2 Type II certified provider. Their API usage policy does not permit
                  them to use your inputs to train their models by default.
                </p>
              </Prose>
            </section>

            {/* 06 Payment Processing */}
            <section>
              <SectionHeader id="payments" num="06" title="Payment Processing" icon={CreditCard} />
              <Prose>
                <p>
                  All payments are processed by <strong className="text-foreground/80">Stripe, Inc.</strong>, a
                  leading payment processor trusted by millions of businesses worldwide.
                </p>
                <BulletList items={[
                  "We never see, store, or have access to your full card number, CVV, or expiry date",
                  "Stripe handles all payment data under PCI DSS Level 1 compliance",
                  "We store only a Stripe Customer ID to manage your subscription",
                  "Billing history and invoices are accessible via your account settings",
                  "Stripe may retain transaction records as required by applicable law",
                ]} />
                <p className="mt-2">
                  Stripe&apos;s privacy practices are described in the{" "}
                  <a
                    href="https://stripe.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Stripe Privacy Policy
                  </a>.
                </p>
              </Prose>
            </section>

            {/* 07 Authentication & Security */}
            <section>
              <SectionHeader id="authentication" num="07" title="Authentication & Security" icon={Lock} />
              <Prose>
                <p>
                  Authentication is managed by <strong className="text-foreground/80">Supabase</strong>, an
                  open-source backend platform with enterprise-grade security.
                </p>
                <BulletList items={[
                  "Passwords are hashed using bcrypt — we can never read your password",
                  "Sessions use short-lived JWT tokens stored in secure, httpOnly cookies",
                  "Google OAuth is available as a sign-in alternative",
                  "All data in transit is encrypted via TLS 1.2+",
                  "Database connections use encrypted channels",
                ]} />
                <p className="mt-2">
                  If you suspect unauthorized access to your account, please contact us immediately at{" "}
                  <a href="mailto:privacy@stacked.ai" className="text-violet-400 hover:text-violet-300 transition-colors">
                    privacy@stacked.ai
                  </a>.
                </p>
              </Prose>
            </section>

            {/* 08 Cookies & Local Storage */}
            <section>
              <SectionHeader id="cookies" num="08" title="Cookies & Local Storage" icon={Cookie} />
              <Prose>
                <p>We use cookies and browser local storage for the following purposes:</p>
                <div className="space-y-3 mt-1">
                  <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 rounded">Required</span>
                      <p className="text-[13px] font-semibold text-foreground">Authentication</p>
                    </div>
                    <p className="text-[13px] text-muted-foreground/65 leading-relaxed">
                      Session tokens to keep you signed in. Cannot be disabled without breaking sign-in.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-blue-400/70 bg-blue-500/10 px-2 py-0.5 rounded">Functional</span>
                      <p className="text-[13px] font-semibold text-foreground">UI Preferences</p>
                    </div>
                    <p className="text-[13px] text-muted-foreground/65 leading-relaxed">
                      Layout preferences and UI state stored in localStorage for a consistent experience.
                    </p>
                  </div>
                </div>
                <p className="mt-4">
                  We do <strong className="text-foreground/80">not</strong> use advertising cookies, cross-site
                  tracking, or any third-party analytics cookies.
                </p>
              </Prose>
            </section>

            {/* 09 Data Retention */}
            <section>
              <SectionHeader id="retention" num="09" title="Data Retention" />
              <Prose>
                <BulletList items={[
                  "Account data is retained for as long as your account is active",
                  "Hand histories and analysis results are retained until you delete them or your account",
                  "Upon account deletion, personal data is removed within 30 days",
                  "Billing records may be retained for up to 7 years as required by financial regulations",
                  "Anonymized, aggregated usage statistics may be retained indefinitely",
                ]} />
                <p className="mt-2">
                  To request early deletion of your data, email{" "}
                  <a href="mailto:privacy@stacked.ai" className="text-violet-400 hover:text-violet-300 transition-colors">
                    privacy@stacked.ai
                  </a>{" "}
                  with the subject &ldquo;Data Deletion Request.&rdquo;
                </p>
              </Prose>
            </section>

            {/* 10 GDPR */}
            <section>
              <SectionHeader id="gdpr" num="10" title="Your Rights (GDPR)" icon={Eye} />
              <Prose>
                <p>
                  If you are located in the European Economic Area (EEA) or United Kingdom, you have the
                  following rights under the GDPR and UK GDPR:
                </p>
                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  {[
                    { right: "Right of Access", desc: "Request a copy of all personal data we hold about you." },
                    { right: "Right to Rectification", desc: "Correct inaccurate or incomplete personal data." },
                    { right: "Right to Erasure", desc: "Request deletion of your personal data." },
                    { right: "Right to Object", desc: "Object to processing of your data for certain purposes." },
                    { right: "Data Portability", desc: "Receive your data in a machine-readable format." },
                    { right: "Right to Restrict", desc: "Limit how we process your data in certain circumstances." },
                  ].map(({ right, desc }) => (
                    <div key={right} className="rounded-xl border border-border/40 bg-card/40 p-3.5">
                      <p className="text-[13px] font-semibold text-foreground mb-1">{right}</p>
                      <p className="text-[12px] text-muted-foreground/65 leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4">
                  To exercise any of these rights, contact{" "}
                  <a href="mailto:privacy@stacked.ai" className="text-violet-400 hover:text-violet-300 transition-colors">
                    privacy@stacked.ai
                  </a>. We will respond within 30 days.
                </p>
                <p>
                  Our legal basis for processing personal data is: <strong className="text-foreground/80">contract performance</strong>{" "}
                  (providing the service), <strong className="text-foreground/80">legitimate interests</strong> (platform
                  security and improvement), and <strong className="text-foreground/80">consent</strong> where explicitly given.
                </p>
              </Prose>
            </section>

            {/* 11 Third-Party Services */}
            <section>
              <SectionHeader id="third-parties" num="11" title="Third-Party Services" />
              <Prose>
                <p>We use the following trusted third-party services to operate the platform:</p>
                <div className="space-y-2.5 mt-1">
                  {[
                    { name: "Supabase", role: "Authentication, database, and storage", link: "https://supabase.com/privacy" },
                    { name: "Stripe", role: "Payment processing and subscription management", link: "https://stripe.com/privacy" },
                    { name: "Anthropic", role: "AI coaching insights via Claude API", link: "https://www.anthropic.com/privacy" },
                    { name: "Vercel", role: "Hosting, CDN, and edge network", link: "https://vercel.com/legal/privacy-policy" },
                  ].map(({ name, role, link }) => (
                    <div key={name} className="flex items-center justify-between rounded-xl border border-border/40 bg-card/40 px-4 py-3">
                      <div>
                        <p className="text-[13px] font-semibold text-foreground">{name}</p>
                        <p className="text-[12px] text-muted-foreground/60 mt-0.5">{role}</p>
                      </div>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-violet-400/70 hover:text-violet-300 transition-colors shrink-0 ml-4"
                      >
                        Privacy policy →
                      </a>
                    </div>
                  ))}
                </div>
              </Prose>
            </section>

            {/* 12 Changes */}
            <section>
              <SectionHeader id="changes" num="12" title="Changes to This Policy" />
              <Prose>
                <p>
                  We may update this Privacy Policy from time to time. When we make significant changes,
                  we will notify you by email and update the &ldquo;Last updated&rdquo; date at the top of this page.
                </p>
                <p>
                  Continued use of Stacked Poker after changes take effect constitutes acceptance of the
                  updated policy. If you disagree with the changes, you may delete your account before
                  the effective date.
                </p>
              </Prose>
            </section>

            {/* 13 Contact */}
            <section>
              <SectionHeader id="contact" num="13" title="Contact Us" icon={Mail} />
              <div className="rounded-2xl border border-border/50 bg-card/50 p-6">
                <p className="text-[14px] text-muted-foreground/75 leading-relaxed mb-5">
                  For any privacy-related questions, data requests, or concerns, contact us at:
                </p>
                <div className="space-y-3">
                  <a
                    href="mailto:privacy@stacked.ai"
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <Mail className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-[12px] text-muted-foreground/50 mb-0.5">Privacy inquiries</p>
                      <p className="text-[14px] font-medium text-violet-400 group-hover:text-violet-300 transition-colors">
                        privacy@stacked.ai
                      </p>
                    </div>
                  </a>
                </div>
                <p className="text-[12px] text-muted-foreground/45 mt-5">
                  We aim to respond to all privacy-related requests within 30 days.
                </p>
              </div>
            </section>

            {/* Cross-link */}
            <div className="rounded-xl border border-border/40 bg-card/30 px-5 py-4 flex items-center justify-between">
              <p className="text-[13px] text-muted-foreground/60">
                Also see our usage terms and subscription policies.
              </p>
              <Link
                href="/terms"
                className="text-[13px] font-medium text-violet-400 hover:text-violet-300 transition-colors shrink-0 ml-4"
              >
                Terms of Service →
              </Link>
            </div>

          </main>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
