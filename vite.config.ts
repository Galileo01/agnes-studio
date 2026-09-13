import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// Keep Wrangler diagnostics inside the terminal in restricted or CI environments.
process.env.WRANGLER_WRITE_LOGS ??= "false";
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === "test" ? [] : [cloudflare()])],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
}));
