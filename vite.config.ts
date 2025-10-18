import { defineConfig } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "plugin.json", dest: "./" },
        { src: "README.md", dest: "./" },
        { src: "index.css", dest: "./" },
        { src: "icon.png", dest: "./" },
        { src: "preview.png", dest: "./" },
        { src: "i18n", dest: "./" }
      ]
    })
  ],
  resolve: {
    alias: {
      "~": resolve(__dirname, "src")
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "GitSyncPlugin",
      fileName: "index",
      formats: ["cjs"]
    },
    rollupOptions: {
      external: ["siyuan", "fs", "path", "child_process", "crypto", "events", "os", "stream", "util"],
      output: {
        entryFileNames: "index.js",
        format: "cjs",
        exports: "default"
      }
    },
    minify: false,
    sourcemap: false
  }
});
