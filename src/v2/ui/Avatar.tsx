// One face, drawn one way, everywhere a person is named (D178).
//
// The owner's call was that a photo is a PROFILE field rather than a Near
// feature: it shows on Near's People tab, on the Kindred cards, and
// anywhere else the app already puts a circle beside a name. One component
// so those cannot drift — and so the single check that turns a document
// into a picture (is it hidden?) lives in one place, which is `loadNames`
// upstream of this.
//
// INITIALS ARE THE PERMANENT FALLBACK, not a placeholder waiting for the
// photo feature. Most accounts will never set one; an account without a
// picture is not a broken row, and it was drawing exactly this before D178
// existed. That is also why the fallback is what renders on a FAILED image
// load: a token that no longer resolves — the object replaced, the bucket
// unreachable — has to look like no photo rather than like a hole.
import React from "react";
import LIVE from "../data/live";
import { avatarUrl, initialsOf } from "../data/avatar";

export default function Avatar({ uid, name, size = 38 }: {
  uid: string;
  /** Their display name — the initials come from it, and it is the alt. */
  name: string;
  size?: number;
}) {
  // A load failure falls back rather than showing a broken image. Keyed by
  // uid so a list that re-orders does not carry one person's failure onto
  // another's row.
  const [failed, setFailed] = React.useState("");
  const token = LIVE.faceFor(uid);
  const src = failed === uid ? "" : avatarUrl(uid, token);
  const initials = initialsOf(name);
  const box: React.CSSProperties = {
    width: size, height: size, flexShrink: 0, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    background: "color-mix(in oklch, var(--accent) 15%, var(--surface-2))",
  };
  if (!src) {
    return (
      <span aria-hidden="true" style={{
        ...box,
        fontFamily: "var(--sans)", fontWeight: 800,
        fontSize: Math.round(size * 0.34),
        color: "var(--ink-2)", letterSpacing: "-0.02em",
      }}>{initials}</span>
    );
  }
  return (
    <span style={box}>
      <img
        src={src}
        // Named, not decorative: on Near's People tab the face IS the row's
        // content, and a screen reader user gets the same fact a sighted
        // one does — that this person has a photo, and whose it is.
        alt={name ? `${name}’s photo` : "Their photo"}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(uid)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </span>
  );
}
