/**
 * Social layer copy. The rules live in the database
 * (supabase/migrations/*social*.sql); this file only maps their error codes
 * to messages. Errors raised by the database look like "social:<code>" or
 * "social:rate_limited:<action>" — see socialErrorMessage().
 */

export const HANDLE = {
  label: "Username",
  help: "Your public @username: it's in your profile link and next to everything you post. You can change it once every 30 days.",
  placeholder: "river_rat",
  save: "Save",
  saving: "Saving…",
  saved: "Username saved",
  nextChange: (date: string) => `You can change it again on ${date}.`,
  errors: {
    length: "Use 3 to 20 characters.",
    characters: "Use lowercase letters, numbers and _ only, starting with a letter or number.",
    reserved: "That username is reserved. Please pick another.",
    profanity: "That username isn't allowed. Please pick another.",
    email: "Don't use your email address. Your username is public.",
    taken: "That username is already taken.",
    too_soon: "You changed your username less than 30 days ago.",
    generic: "Could not save. Please try again.",
  } as Record<string, string>,
};

export const HANDLE_PROMPT = {
  title: "Pick your username",
  body: "Friends find you by it, and it shows next to the hands you share. Your email stays private.",
  suggestion: "Suggestion",
  use: "Use this",
  later: "Not now",
};

export const ACCOUNT_DATA = {
  title: "Your data",
  exportLabel: "Download your data",
  exportHelp: "A JSON file with your profile, hands, notes, training history and social activity.",
  exporting: "Preparing…",
  exportFailed: "Could not prepare your download. Please try again.",
  deleteLabel: "Delete account",
  deleteHelp:
    "Permanently deletes your account, hands, notes and training progress. Messages and posts you wrote stay in their conversations as “[deleted user]”. This can't be undone.",
  deleteConfirmPrompt: "Type DELETE to confirm",
  deleteConfirmWord: "DELETE",
  deleteButton: "Delete my account",
  deleting: "Deleting…",
  deleteFailed: "Could not delete your account. Please try again or contact support.",
  deleteActiveSubscription: "Cancel your Pro subscription first (Manage subscription above), then delete your account.",
};

export const MODERATION = {
  title: "Moderation",
  tabs: { open: "Open", actioned: "Actioned", dismissed: "Dismissed", users: "Users" },
  empty: "No reports here.",
  loadMore: "Load more",
  reportedBy: "Reported by",
  owner: "Owner",
  openReports: (n: number) => `${n} open report${n === 1 ? "" : "s"} on this`,
  hidden: "Hidden",
  actions: {
    hide: "Hide content",
    unhide: "Unhide",
    dismiss: "Dismiss",
    reopen: "Reopen",
    ban1d: "Ban 1 day",
    ban7d: "Ban 7 days",
    banForever: "Ban permanently",
    unban: "Unban",
    makeModerator: "Make moderator",
    makeUser: "Remove moderator",
  },
  confirmBanForever: "Ban this user permanently?",
  searchPlaceholder: "Search @username or name",
  bannedUntil: (d: string) => `Banned until ${d}`,
  bannedForever: "Banned permanently",
  done: "Done",
  failed: "That didn't work. Please try again.",
};

export const REPORT_REASONS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate: "Hate speech",
  cheating: "Cheating / RTA",
  inappropriate: "Inappropriate content",
  privacy: "Shares private information",
  other: "Something else",
};

export const DELETED_USER = "[deleted user]";

const SOCIAL_ERRORS: Record<string, string> = {
  not_signed_in: "Please sign in first.",
  banned: "Your account can't post right now.",
  forbidden: "You don't have permission to do that.",
  text_empty: "Write something first.",
  text_length: "That's too long.",
  text_hate: "That language isn't allowed here.",
  text_links: "Too many links. Please keep it to three.",
  text_repeat: "Please don't spam characters.",
  invalid: "That didn't work.",
  not_found: "That no longer exists.",
  duplicate: "You already reported this. Our moderators will take a look.",
  share_invalid: "This hand can't be shared. Please try again.",
  generic: "Something went wrong. Please try again.",
};

const RATE_LIMITED: Record<string, string> = {
  message: "You're sending messages too fast. Wait a moment.",
  share: "You've reached today's share limit. Pro has no limit.",
  report: "You've sent a lot of reports today. Thanks, we'll get to them.",
  friend_request: "You've sent a lot of friend requests today. Try again tomorrow.",
  thread: "You've started the maximum number of threads for now.",
  reply: "You're replying too fast. Wait a moment.",
};

/**
 * A user-facing message for a database error message or an RPC error code:
 * "social:text_hate", "social:rate_limited:share", or a bare "duplicate".
 */
export function socialErrorMessage(raw: string | null | undefined): string {
  if (!raw) return SOCIAL_ERRORS.generic;
  const m = /social:([a-z_]+)(?::([a-z_]+))?/.exec(raw);
  const code = m ? m[1] : raw;
  if (code === "rate_limited") return RATE_LIMITED[m?.[2] ?? ""] ?? "Slow down a little and try again.";
  return SOCIAL_ERRORS[code] ?? SOCIAL_ERRORS.generic;
}

/** Instant feedback before the round trip; the database has the final say. */
export function handleFormatError(handle: string): string | null {
  const v = handle.trim().replace(/^@/, "").toLowerCase();
  if (!v) return null;
  if (v.length < 3 || v.length > 20) return HANDLE.errors.length;
  if (!/^[a-z0-9][a-z0-9_]*$/.test(v)) return HANDLE.errors.characters;
  return null;
}

/** What the user typed, as the database will store it. */
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

// ── Hand sharing (Phase 1) ──────────────────────────────────────────────────

export const SHARE = {
  button: "Share",
  title: "Share this hand",
  visibility: {
    label: "Who can see it",
    link: "Anyone with the link",
    friends: "Friends only",
    public: "Public",
    help: {
      link: "Not listed anywhere and hidden from search engines.",
      friends: "Only your friends, signed in.",
      public: "On your profile and findable by search engines.",
    },
  },
  showHeroCards: "Show my cards",
  showResult: "Show the result",
  guessMode: "Guess mode",
  guessModeHelp: "The hand stops at your decision. Viewers vote first, then see what you did and how others voted.",
  guessSpot: "Stop at",
  noDecision: "There's no decision of yours to quiz in this hand.",
  decisionLabel: (street: string, facing: string | null, did: string) =>
    `${street} · ${facing ? `facing ${facing}` : "nothing to call"} · you ${did}`,
  pastTense: { fold: "folded", check: "checked", call: "called", bet: "bet", raise: "raised" } as Record<string, string>,
  question: "Your question (optional)",
  questionPlaceholder: "Call or fold?",
  create: "Create link",
  creating: "Creating…",
  copy: "Copy link",
  copied: "Link copied",
  shareVia: "Share via…",
  whatsapp: "WhatsApp",
  x: "X",
  reddit: "Reddit",
  discord: "Discord",
  discordCopied: "Link copied. Paste it in Discord.",
  embed: "Embed",
  embedCopy: "Copy embed code",
  embedCopied: "Embed code copied",
  existing: "Your links for this hand",
  views: (n: number) => `${n} view${n === 1 ? "" : "s"}`,
  votes: (n: number) => `${n} vote${n === 1 ? "" : "s"}`,
  revoke: "Revoke",
  revoked: "Link revoked",
  revokedLabel: "Revoked",
  hiddenLabel: "Hidden by a moderator",
  save: "Save changes",
  saved: "Changes saved",
  newLink: "New link",
  privacyNote: "Opponents are shown by position only. Your screen name, hand number and table are never shared.",
  failed: "Could not share this hand. Please try again.",
};

export const SHARED_HAND = {
  sharedBy: (name: string) => `Shared by ${name}`,
  defaultQuestion: "Call or fold? 🤔",
  notFound: "This hand isn't available. The link may have been revoked.",
  yourTurn: "Hero to act. What would you do?",
  heroToAct: "Hero to act",
  choice: { fold: "Fold", check: "Check", call: "Call", bet: "Bet", raise: "Raise" } as Record<string, string>,
  voting: "Voting…",
  heroDid: (choice: string) => `Hero chose to ${choice.toLowerCase()}.`,
  youPicked: (choice: string) => `You picked ${choice.toLowerCase()}.`,
  matched: "Same as Hero.",
  votesTitle: "How others voted",
  totalVotes: (n: number) => `${n} vote${n === 1 ? "" : "s"}`,
  rangesTitle: "What the ranges say",
  preflopVerdict: "Hero's preflop play:",
  noRanges: "No chart covers this spot yet.",
  resultHidden: "The owner chose not to show the result.",
  ownerPreview: "You're viewing your own share. Others see it as set in the share options.",
  hiddenNotice: "Hidden by a moderator. Only you and moderators can see it.",
  revokedNotice: "Revoked. Only you can still see it.",
  report: "Report",
  reported: "Thanks, our moderators will take a look.",
  stacksInBb: "Stacks in big blinds",
  ctaTitle: "Analyze your own hands, free",
  ctaBody: "Import your tournaments and see where you lose chips.",
  ctaButton: "Start free",
  ctaDismiss: "Dismiss",
  poweredBy: "Powered by Stacked Poker",
  openFull: "Open on Stacked Poker",
  metaTitle: (q: string) => `${q} · Poker hand`,
  metaDescription: (pos: string, stack: string, pot: string) => `${pos} with ${stack} BB, pot ${pot} BB. Replay the hand and vote on Stacked Poker.`,
};
