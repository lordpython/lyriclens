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
  // Load env from .env files
  // First load VITE_ prefixed vars (default behavior)
  const viteEnv = loadEnv(mode, ".", "VITE_");
  // Then load all vars including non-prefixed ones
  const allEnv = loadEnv(mode, ".", "");
  
  const isMobileBuild = process.env.CAPACITOR_BUILD === 'true';
  
  // Prioritize GEMINI_API_KEY from .env files, fallback to VITE_ prefixed
  const apiKey = allEnv.GEMINI_API_KEY || viteEnv.VITE_GEMINI_API_KEY || "";
  
  // Debug: Log which API key is being used (first 10 chars only)
  console.log(`[Vite Config] GEMINI_API_KEY: ${apiKey.substring(0, 10)}...`);

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
      "process.env.API_KEY": JSON.stringify(apiKey),
      "process.env.GEMINI_API_KEY": JSON.stringify(apiKey),
      "process.env.VITE_GEMINI_API_KEY": JSON.stringify(apiKey),
      "process.env.VITE_DEAPI_API_KEY": JSON.stringify(
        allEnv.VITE_DEAPI_API_KEY || viteEnv.VITE_DEAPI_API_KEY || "",
      ),
      "process.env.DEAPI_API_KEY": JSON.stringify(allEnv.VITE_DEAPI_API_KEY || viteEnv.VITE_DEAPI_API_KEY || ""),
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
