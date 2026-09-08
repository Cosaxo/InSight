// PickCredits — the attribution beside the pictures (D421).
//
// A CC BY picture may be shown on one condition: that the author and the
// licence are shown too. TMDB's terms ask for one sentence. This is that
// condition, drawn where the pictures are — under the browse row and
// under the reveal's two tiles — as a small door that opens into the
// domain's whole credits list, fetched from hosting the first time it is
// opened and never before (most readers never open it, and the manifest
// is the size of the catalogue). Nothing here renders for a domain with
// no pictures: the door is the licence's condition, not furniture.
//
// The copy rule (D182) does not shorten this: an attribution is a claim
// the licence requires, so the author's name and the licence's name are
// the content, and "source" is the link the licence asks for.
import React from "react";
import {
  hasCatalogArt, loadCatalogCredits, SOURCE_NOTICES, COMMONS_NOTICE, type CatalogCredit,
} from "../data/catalogArt";

export default function PickCredits({ domain, accent }: { domain: string; accent: string }) {
  const has = hasCatalogArt(domain);
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<CatalogCredit[] | null>(null);
  const [err, setErr] = React.useState(false);

  React.useEffect(() => {
    if (!open || rows || !has) return;
    let live = true;
    setErr(false);
    loadCatalogCredits(domain).then(
      (r) => { if (live) setRows(r); },
      () => { if (live) setErr(true); },
    );
    return () => { live = false; };
  }, [open, rows, has, domain]);

  if (!has) return null;
  // A ruled source (TMDB, PokéAPI) gets its notice once and no author
  // line per row — the notice IS the credit; everything else is Commons,
  // where the author and the licence on each row are the condition.
  const ruled = rows ? [...new Set(rows.map((r) => r.licence).filter((l) => SOURCE_NOTICES[l]))] : [];
  const commons = !!rows && rows.some((r) => !SOURCE_NOTICES[r.licence]);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
      {/* Drawn small, pressed at 44 — .tap44 grows the hit box (styles.css §12). */}
      <button
        type="button"
        className="tap44"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          border: "none", background: "none", padding: "2px 0", cursor: "pointer", WebkitAppearance: "none",
          fontFamily: "var(--sans)", fontWeight: 600, fontSize: 11.5, color: "var(--ink-3)",
          textDecoration: "underline dotted", textUnderlineOffset: 3,
        }}
      >
        Image credits
      </button>
      {open && (
        <div
          role="region"
          aria-label="Image credits"
          style={{
            width: "100%", maxHeight: 220, overflowY: "auto", boxSizing: "border-box", padding: "8px 11px",
            border: "0.5px solid var(--rule)", borderRadius: 10, background: "var(--surface-2)",
            fontFamily: "var(--sans)", fontSize: 11.5, lineHeight: 1.45, color: "var(--ink-2)",
          }}
        >
          {err && <p role="status" style={{ margin: 0 }}>Couldn&apos;t load the credits. Try again later.</p>}
          {!err && !rows && <p role="status" style={{ margin: 0 }}>Loading…</p>}
          {ruled.map((tag) => <p key={tag} style={{ margin: "0 0 6px" }}>{SOURCE_NOTICES[tag]}</p>)}
          {rows && commons && <p style={{ margin: "0 0 6px" }}>{COMMONS_NOTICE}</p>}
          {rows && (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {rows.map((r) => (
                <li key={r.key}>
                  {r.name}
                  {SOURCE_NOTICES[r.licence] ? "" : ` — ${r.author} · ${r.licence}`}
                  {" "}
                  <a href={r.source} target="_blank" rel="noreferrer noopener" style={{ color: accent }}>source</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
