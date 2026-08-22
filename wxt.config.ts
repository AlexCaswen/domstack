import { defineConfig } from "wxt";
import packageJson from "./package.json";

export default defineConfig({
  modules: ["@wxt-dev/module-svelte"],
  manifest: {
    name: "DOMstack",
    version: packageJson.version,
    description:
      "Auto-skips Substack's pledge prompts, share nags, and other subscribe-flow interruptions. Just subscribe and read.",
    permissions: ["storage"],
    host_permissions: ["*://*.substack.com/*"],
    icons: {
      16: "icons/icon16.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png",
    },
    action: {
      default_icon: {
        16: "icons/icon16.png",
        48: "icons/icon48.png",
        128: "icons/icon128.png",
      },
    },
  },
});
