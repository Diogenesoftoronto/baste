import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import pandaPostcss from "@pandacss/postcss";

export default defineConfig(() => {
  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
    server: {
      port: Number(process.env.BASTE_SITE_PORT || 5173),
      strictPort: true,
      proxy: { '/api': { target: `http://127.0.0.1:${process.env.BASTE_API_PORT || 3456}`, changeOrigin: false } },
    },
    preview: {
      proxy: { '/api': { target: `http://127.0.0.1:${process.env.BASTE_API_PORT || 3456}`, changeOrigin: false } },
      headers: {
        "Cache-Control": "public, max-age=600",
      },
    },
    css: {
      postcss: {
        plugins: [pandaPostcss() as any],
      },
    },
  };
});
