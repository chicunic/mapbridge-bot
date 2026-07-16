import type { Linter } from "eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const sharedExtends = [
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintConfigPrettier,
];

const sharedLanguageOptions = {
  parserOptions: {
    projectService: true,
    tsconfigRootDir: import.meta.dirname,
  },
};

const sharedRules: Linter.RulesRecord = {
  "sort-imports": ["error", { ignoreDeclarationSort: true }],
  "object-shorthand": "error",
  "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true, allowBoolean: true }],
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
};

export default defineConfig([
  globalIgnores(["dist/**", "coverage/**", ".wrangler/**"]),
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    extends: sharedExtends,
    languageOptions: sharedLanguageOptions,
    rules: { ...sharedRules },
  },
]);
