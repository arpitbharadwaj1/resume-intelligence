import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "@typescript-eslint/eslint-plugin";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },

  // Already a flat-config array, and already includes next/typescript.
  ...nextCoreWebVitals,

  {
    // Flat config scopes plugin namespaces per config object, so the plugin is
    // registered here rather than inherited from the Next config above.
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      // CLAUDE.md section 4: `any` is forbidden.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    files: ["**/*.{ts,tsx,mjs,js}"],
    rules: {
      eqeqeq: ["error", "always"],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  // ---------------------------------------------------------------------------
  // Principle 3, enforced rather than remembered.
  //
  // The scoring engine must never see a model. If you hit this rule, the design
  // is wrong, not the rule -- an LLM signal belongs in lib/analysis/ as a bounded
  // per-item classification producing a feature value, which lib/scoring/ then
  // consumes. See docs/MEASUREMENT.md R2.
  // ---------------------------------------------------------------------------
  {
    files: ["lib/scoring/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/ai/**", "@/lib/ai/**", "@anthropic-ai/*"],
              message:
                "lib/scoring must not import from lib/ai. Final scores are computed by deterministic code, never by an LLM (Principle 3). Produce a feature value in lib/analysis/ instead.",
            },
            {
              group: ["**/lib/supabase/**", "@/lib/supabase/**"],
              message:
                "lib/scoring must be pure. Load data in the orchestrator and pass a feature vector in.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["tests/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    rules: { "no-console": "off" },
  },
];

export default config;
