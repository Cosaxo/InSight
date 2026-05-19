import { registerPlugin } from "@capacitor/core";
const InsightHealth = registerPlugin("InsightHealth", {
    web: () => import("./web").then((m) => new m.InsightHealthWeb()),
});
export * from "./definitions";
export { InsightHealth };
