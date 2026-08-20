import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          {
            src: "node_modules/tesseract.js/dist/worker.min.js",
            dest: "tesseract",
            rename: { stripBase: true },
          },
          {
            src: "node_modules/tesseract.js-core/tesseract-core*-lstm.wasm*",
            dest: "tesseract/core",
            rename: { stripBase: true },
          },
          {
            src: "node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz",
            dest: "tesseract/lang",
            rename: { stripBase: true },
          },
        ],
      }),
    ],
    build: {
      target: "es2022",
      sourcemap: true,
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
