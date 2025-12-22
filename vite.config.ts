import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

// Filter out known Tailwind v4 PostCSS warning (upstream issue, cosmetic only)
const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = args[0];
  if (
    typeof msg === "string" &&
    msg.includes("did not pass the `from` option")
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: {
      port: 3000,
      // Use localhost to ensure COOP/COEP headers work properly
      // (required for SharedArrayBuffer in FFmpeg WASM)
      host: "localhost",
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
    },
    plugins: [react()],
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    },
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.VITE_DEAPI_API_KEY": JSON.stringify(
        env.VITE_DEAPI_API_KEY || "",
      ),
      "process.env.DEAPI_API_KEY": JSON.stringify(env.VITE_DEAPI_API_KEY || ""),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    optimizeDeps: {
      exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
    },
  };
});
