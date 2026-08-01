The generator is `scripts/gen-v2content.mjs` — recreated 2026-08-01 after
the original (which lived only in Phase-2 session notes) was lost; recovery
was proven by reproducing the committed file byte-for-byte. Regenerate with
`npm run build:content`; drift is caught by `npm run check:content` on the
deploy path. The id scheme (daily-NNN / feed-<id> / group-<id> / duo-NNN /
test-<key>-NN) is documented in the script header.
