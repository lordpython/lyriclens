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
  const isMobileBuild = process.env.CAPACITOR_BUILD === 'true';

  return {
    // Use relative paths for Capacitor mobile builds
    base: isMobileBuild ? './' : '/',
    server: {
      port: 3000,
      host: "localhost",
      // COOP/COEP headers for SharedArrayBuffer (FFmpeg WASM) - web only
      // These headers break mobile WebViews, so only apply in web dev mode
      headers: isMobileBuild ? {} : {
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
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-genai': ['@google/genai'],
            'vendor-motion': ['framer-motion'],
            'vendor-radix': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-select',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-slider',
              '@radix-ui/react-switch',
              '@radix-ui/react-progress',
            ],
          },
        },
      },
    },
  };
});
