import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "test/a2a.test": "test/a2a.test.ts",
    "demo/cross-chain-demo": "demo/cross-chain-demo.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "es2022",
  platform: "node",
});
