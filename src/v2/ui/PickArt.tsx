// PickArt — the picture on a pick tile, where the catalogue has one (D421).
//
// Drawn OVER the generated face rather than instead of it: the pattern is
// the permanent fallback, the way initials are under a profile photo
// (Avatar.tsx). The image is transparent until its bitmap has decoded and
// fades in (.wf-tileimg — the duel tile's one treatment, shared rather
// than copied), so a slow network shows the face and then the picture,
// never a hole; and a failed load — a taken-down file, an unreachable
// host — unmounts it, so the face is what remains. The caller's box is
// `position: relative; overflow: hidden`; this is an absolutely
// positioned child of it.
//
// FITTED, NOT CROPPED (.is-fit), which is the half of that treatment a
// catalogue picture cannot share. The duel's photograph is a scene and
// survives a crop; this is a SUBJECT, and the builder has already fitted
// it inside a square, so cover-cropping it into a wide face cuts the
// subject's middle out — the reveal's two faces are 2:1, and a square
// Pokémon lost its head there. The pattern behind it frames whatever the
// aspect leaves over, which is the same job it does when there is no
// picture at all.
//
// Decorative to assistive tech on purpose: every surface that draws it
// already names the entry beside it (the tile's aria-label, the reveal's
// caption), so `alt=""` is the honest description and a second name would
// be read twice.
import React from "react";
import { catalogArtUrl } from "../data/catalogArt";

export default function PickArt({ domain, id }: { domain: string; id: number }) {
  const url = catalogArtUrl(domain, id);
  // Keyed by URL, not a boolean: a re-keyed tile in a paged row keeps
  // state at the position (Avatar.tsx's finding), so a failure has to
  // say WHICH picture failed.
  const [failed, setFailed] = React.useState("");
  if (!url || failed === url) return null;
  return (
    <img
      className="wf-tileimg is-fit"
      data-pick-art=""
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onLoad={(e) => e.currentTarget.classList.add("is-in")}
      onError={() => setFailed(url)}
    />
  );
}
