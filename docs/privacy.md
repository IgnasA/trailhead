# Privacy

<!-- GENERATED from packages/domain/src/privacy.ts — edit that file, then run `pnpm docs:privacy`. -->

Trailhead reads flight emails. Nothing else.

## The permission we ask for

`gmail.readonly`

That is Google's read-only Gmail permission: Trailhead can search and read messages to find flights, and can never send, modify, or delete anything. Email bodies are fetched only while you look at them and are never kept.

## What we store

- Flight records we extract
- Flights you add yourself
- Message ID + subject line
- A hash, to avoid re-reading

## What we never store

- Email bodies
- Non-flight mail, at all
- Attachments

## What you can delete, and what each one means

### Disconnect Gmail

Stop Trailhead reading your mail. Nothing is deleted.

We revoke the access Google gave us and destroy the stored token. Your flights, trips and source-email records all stay exactly as they are. Reconnect any time to import again.

### Delete my emails

Forget which emails your history came from.

Every stored message ID, subject line and hash goes, along with the extractions taken from them. Your flights and trips survive — their provenance will simply say the source was deleted, and "view source email" stops working for them. A later import has to read those messages again from scratch.

### Delete my history

Forget the flights and trips we reconstructed.

Flights, trips and your corrections are removed. The email records stay, so importing again rebuilds your history without re-reading Gmail. Flights you added by hand are kept too, and reappear the next time your history is rebuilt — they are yours, not something we reconstructed. Doing every deletion leaves nothing derived and nothing remembered.

### Delete the flights I added

Forget the flights you typed in yourself.

Every flight you entered by hand is removed, and this one genuinely cannot be undone — there was never an email behind them, so nothing can bring them back. Your imported flights, trips and email records are untouched.

### Delete my account

Everything, permanently.

Your account, your Gmail token, your flights, trips, source-email records, the flights you added yourself and your corrections are all deleted. Nothing is kept — not even anonymised. This cannot be undone.

