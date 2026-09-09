# Catalogue art — the pictures on the pick tiles (D421)

One directory per catalogue domain, written only by
`scripts/build-catalog-art.mjs`, never by hand:

    web/catalog-art/<domain>/<key>.<jpg|png|webp>   the picture, thumbnail-sized
    web/catalog-art/<domain>/credits.tsv            key · file · name · author · licence · source

The key is the entry's key in the domain's catalogue file under
`public/`, so a picture can
never point at anything a stored answer does not. `credits.tsv` is what
the app's *Image credits* sheet draws, and the licence's condition for
showing the picture at all. `check:catalog-art` holds the directory to
its credits, the credits to the catalogue, both to
`src/v2/data/catalogArtIndex.ts`, and `firebase.json` to the headers the
app needs from here (CORS for the credits fetch, an hour's cache).

**This is hosting, not the app.** Firebase Hosting serves `web/`, so the
app fetches these from `https://prvfire33.web.app/catalog-art/…` and the
files never enter the binary — which is what makes a takedown a commit:

    node scripts/build-catalog-art.mjs <domain> --remove <key>

removes the file and its row, regenerates the index, and the merge
deploys hosting. A device stops drawing the picture within the hour.
This README is on the hosting ignore list and is not served.

`docs/CATALOG-QUESTIONS.md` § Entity images has the per-domain licensing
map and the owner's ruling.
