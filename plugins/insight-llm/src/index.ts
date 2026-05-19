import { registerPlugin } from "@capacitor/core";

import type { InsightLLMPlugin } from "./definitions";

// Native binding. The web shim throws on every method call — vision
// inference doesn't run in the browser. (If you want a web fallback
// later, swap the second argument for an async loader that imports
// the JS MediaPipe LLM SDK.)
const InsightLLM = registerPlugin<InsightLLMPlugin>("InsightLLM", {
  web: () => import("./web").then((m) => new m.InsightLLMWeb()),
});

export * from "./definitions";
export { InsightLLM };
