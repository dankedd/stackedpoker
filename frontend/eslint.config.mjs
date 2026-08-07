import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // A leading underscore is the conventional "deliberately unused" marker.
      // Needed for callback and handler parameters whose POSITION is fixed by a
      // signature we don't control — deleting one would shift every parameter
      // after it, so the only safe way to mark it unused is to rename it.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Vitest specs are never bundled, so two of the default rules don't carry
    // their usual meaning here: `no-assign-module-variable` guards webpack's
    // `module` global, and `no-explicit-any` fights fixtures that deliberately
    // feed malformed input to assert a failure path. Everything else still
    // applies, and `tsc --noEmit` typechecks these files regardless.
    files: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
