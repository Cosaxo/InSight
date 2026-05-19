import { registerPlugin } from "@capacitor/core";

import type { InsightHealthPlugin } from "./definitions";

const InsightHealth = registerPlugin<InsightHealthPlugin>("InsightHealth", {
  web: () => import("./web").then((m) => new m.InsightHealthWeb()),
});

export * from "./definitions";
export { InsightHealth };
