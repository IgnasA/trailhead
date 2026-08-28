// The privacy copy, once. The permission screen (frame 1b), the privacy page
// and docs/privacy.md all render from here, so they cannot drift — the
// wireframe requires the consent screen and the privacy page to match
// word-for-word, and the privacy ticket made that a structural requirement
// rather than a promise to remember.

export const GMAIL_SCOPE = "gmail.readonly";

export const WE_STORE = [
  "Flight records we extract",
  "Message ID + subject line",
  "A hash, to avoid re-reading",
] as const;

export const WE_NEVER_STORE = [
  "Email bodies",
  "Non-flight mail, at all",
  "Attachments",
] as const;

/** Said precisely: subjects ARE stored, so "no email content" would be a lie
 *  (Gmail research, Limited Use). */
export const SCOPE_EXPLANATION =
  "That is Google's read-only Gmail permission: Trailhead can search and read messages to find flights, and can never send, modify, or delete anything. Email bodies are fetched only while you look at them and are never kept.";

export interface PrivacyAction {
  id: "disconnect" | "delete_emails" | "delete_history" | "delete_account";
  title: string;
  summary: string;
  consequence: string;
  confirm: string;
  destructive: boolean;
}

/** Three separate, separately-worded actions — because they are three
 *  different requests, and derived history outlives the emails it came from. */
export const PRIVACY_ACTIONS: PrivacyAction[] = [
  {
    id: "disconnect",
    title: "Disconnect Gmail",
    summary: "Stop Trailhead reading your mail. Nothing is deleted.",
    consequence:
      "We revoke the access Google gave us and destroy the stored token. Your flights, trips and source-email records all stay exactly as they are. Reconnect any time to import again.",
    confirm: "Disconnect",
    destructive: false,
  },
  {
    id: "delete_emails",
    title: "Delete my emails",
    summary: "Forget which emails your history came from.",
    consequence:
      "Every stored message ID, subject line and hash goes, along with the extractions taken from them. Your flights and trips survive — their provenance will simply say the source was deleted, and \"view source email\" stops working for them. A later import has to read those messages again from scratch.",
    confirm: "Delete emails",
    destructive: true,
  },
  {
    id: "delete_history",
    title: "Delete my history",
    summary: "Forget the flights and trips we reconstructed.",
    consequence:
      "Flights, trips and your corrections are removed. The email records stay, so importing again rebuilds your history without re-reading Gmail. Doing both deletions leaves nothing derived and nothing remembered.",
    confirm: "Delete history",
    destructive: true,
  },
  {
    id: "delete_account",
    title: "Delete my account",
    summary: "Everything, permanently.",
    consequence:
      "Your account, your Gmail token, your flights, trips, source-email records and corrections are all deleted. Nothing is kept — not even anonymised. This cannot be undone.",
    confirm: "Delete everything",
    destructive: true,
  },
];
