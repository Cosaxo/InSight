// The invitation inbox's wording (D122).
//
// fetchInvites needs Firestore and is covered by the rules suite and the
// e2e; what is pure — and what ships wrong most often — is the sentence a
// row leads with. An unnamed inviter is the COMMON case on a young
// account (displayName is optional and starts empty), so `"" invited you
// to ""` is the shape that reaches a screen if nobody checks.

import { describe, expect, it } from "vitest";
import { inviteLine, type Invite } from "./invites";

const inv = (over: Partial<Invite> = {}): Invite => ({
  gid: "g1", groupName: "The Crew", mode: "group",
  from: "u_other", fromName: "Olaf", at: 1, ...over,
});

describe("inviteLine", () => {
  it("names the person and the circle when it has both", () => {
    expect(inviteLine(inv())).toBe("Olaf invited you to The Crew");
  });

  it("reads as a challenge for a 1v1, not as a membership offer", () => {
    expect(inviteLine(inv({ mode: "duo", groupName: "Mira & Leo" })))
      .toBe("Olaf wants to play Mira & Leo with you");
  });

  it("falls back to Someone rather than an empty name", () => {
    // The same word the who-voted sheet and Kindred use for an account
    // with no display name — one vocabulary for one state.
    expect(inviteLine(inv({ fromName: "" }))).toBe("Someone invited you to The Crew");
    expect(inviteLine(inv({ fromName: "   " }))).toBe("Someone invited you to The Crew");
  });

  it("falls back to a generic circle rather than an empty name", () => {
    expect(inviteLine(inv({ groupName: "" }))).toBe("Olaf invited you to a circle");
    expect(inviteLine(inv({ mode: "duo", groupName: "" }))).toBe("Olaf wants to play 1v1 with you");
  });

  it("survives both being empty at once", () => {
    expect(inviteLine(inv({ fromName: "", groupName: "" })))
      .toBe("Someone invited you to a circle");
  });
});
