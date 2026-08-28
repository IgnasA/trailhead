// docs/privacy.md is generated from packages/domain/src/privacy.ts so the
// document, the permission screen and the privacy page cannot drift apart.
// Run: pnpm docs:privacy   (CI checks it is up to date)
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  GMAIL_SCOPE, PRIVACY_ACTIONS, SCOPE_EXPLANATION, WE_NEVER_STORE, WE_STORE,
} from "../packages/domain/src/privacy.ts";

const md = `# Privacy

<!-- GENERATED from packages/domain/src/privacy.ts — edit that file, then run \`pnpm docs:privacy\`. -->

Trailhead reads flight emails. Nothing else.

## The permission we ask for

\`${GMAIL_SCOPE}\`

${SCOPE_EXPLANATION}

## What we store

${WE_STORE.map((x) => `- ${x}`).join("\n")}

## What we never store

${WE_NEVER_STORE.map((x) => `- ${x}`).join("\n")}

## What you can delete, and what each one means

${PRIVACY_ACTIONS.map((a) => `### ${a.title}\n\n${a.summary}\n\n${a.consequence}\n`).join("\n")}
`;

await writeFile(path.join(import.meta.dirname, "..", "docs", "privacy.md"), md);
console.log("docs/privacy.md regenerated");
