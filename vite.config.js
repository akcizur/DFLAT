import { defineConfig } from "vite";

// GitHub Actions builds the site for its repository subpath. Local dev/preview
// stay rooted at / so developers can open the standard Vite localhost URL.
const base = process.env.GITHUB_ACTIONS === "true" ? "/DFLAT/" : "/";

export default defineConfig({
  base,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false
  }
});
