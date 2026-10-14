import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Storybook copies staticDirs; Vite must not race that copy into assets/.
  publicDir: false,
  plugins: [qwikVite({ csr: true }), tsconfigPaths()],
  // Vite loads the site's existing postcss.config.cjs, including Panda.
  css: { postcss: fileURLToPath(new URL("../", import.meta.url)) },
});
