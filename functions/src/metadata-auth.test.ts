// metadata-auth.test.ts — the runtime can read a metadata-server response.
//
// WHY THIS EXISTS. On 2026-08-06 an `overrides` entry in package.json forced
// gaxios ^7.1.5 onto gcp-metadata@6.1.1, which declares ^6.1.1. gaxios 7
// returns a fetch `Headers` object where 6 returned a plain object, and
// gcp-metadata reads the header as `res.headers['metadata-flavor']` — a
// property lookup that is always `undefined` on a Headers instance. Every
// function in the project then threw:
//
//   Invalid response from metadata service: incorrect Metadata-Flavor
//   header. Expected 'Google', got no header
//
// and could not authenticate to any Google API. scheduledDuelReveals failed
// every two hours, buildModQueue and ledgerVelocityScan daily, and
// seedContentV2 on every call, for over a day.
//
// NOTHING CAUGHT IT, and that is the part worth fixing rather than just the
// version. The emulator injects its own credentials, so no e2e touches the
// metadata path; tsc, eslint and every check: gate are blind to a transitive
// version conflict; and `npm audit` — the one thing measuring this corner —
// was measuring advisories, which the override improved while breaking
// authentication. A green tree and a dead backend at the same time.
//
// So: a real HTTP server that answers exactly as the GCE metadata server
// does, and a real gcp-metadata call against it. No network, no emulator,
// tens of milliseconds. It fails if the gaxios override comes back, or if
// any future bump puts gcp-metadata and gaxios on incompatible majors again.

import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";

let server: Server | undefined;
afterEach(() => { server?.close(); server = undefined; });

async function fakeMetadataServer(headers: Record<string, string>) {
  server = createServer((_req, res) => {
    res.writeHead(200, { ...headers, "content-type": "application/json" });
    res.end(JSON.stringify({ access_token: "fake", expires_in: 3600, token_type: "Bearer" }));
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", () => r()));
  const addr = server!.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return `127.0.0.1:${addr.port}`;
}

describe("metadata server credentials — the whole backend depends on this", () => {
  it("reads a token from a response carrying Metadata-Flavor: Google", async () => {
    process.env.GCE_METADATA_HOST = await fakeMetadataServer({ "Metadata-Flavor": "Google" });
    const gcp = await import("gcp-metadata");
    // The assertion is simply that this does not throw. When gcp-metadata and
    // gaxios disagree about the shape of `res.headers`, it throws "got no
    // header" against a response that plainly has one — which is the exact
    // failure this file exists for.
    const token = await gcp.instance("service-accounts/default/token");
    expect(token).toMatchObject({ access_token: "fake" });
  });

  it("still rejects a response that genuinely lacks the header", async () => {
    // The guard has to keep guarding. A fix that made gcp-metadata accept
    // anything would pass the test above and be worse than the bug, since
    // the header is what proves the responder is really the metadata server
    // and not something else answering on that address.
    process.env.GCE_METADATA_HOST = await fakeMetadataServer({});
    const gcp = await import("gcp-metadata");
    await expect(gcp.instance("service-accounts/default/token")).rejects.toThrow(/Metadata-Flavor/);
  });
});
