// The app's name, server side.
//
// A COPY of src/v2/data/brand.ts's `BRAND_DEFAULT`, on purpose: the
// functions package cannot import the client's modules, and the one place
// the server says the name is a push notification's title. When the client
// moves the name (D-2026-09-12a: Doxa, the owner's 2026-09-12 ruling), move
// this line with it — a push that arrives titled with the old name is the
// one place the rename would be visible before the app opens.
export const BRAND_NAME = "Doxa";
