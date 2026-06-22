import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  target: "node20",
  platform: "node",
  dts: true,
  clean: true,
  cjsInterop: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
  // googleapis/dayjs are runtime dependencies — keep them external (not bundled).
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
