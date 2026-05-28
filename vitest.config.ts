import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run actcheck's own tests — never recurse into competitor clones
    // or other working material that may sit under tmp/.
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "tmp", ".worktrees"],
  },
});
