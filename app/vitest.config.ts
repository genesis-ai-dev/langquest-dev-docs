import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/schema-designer/**/*.test.ts"],
    server: {
      deps: {
        inline: [/@azimutt\//],
      },
    },
  },
});
