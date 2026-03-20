import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// Extract the @typescript-eslint plugin from the Next.js flat config so we can
// reference it in our custom overrides without re-installing it separately.
const tsPlugin = nextCoreWebVitals.find((c) => c.plugins?.["@typescript-eslint"])
  ?.plugins["@typescript-eslint"];

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "next-env.d.ts",
      "node_modules/**",
    ],
  },
  {
    plugins: {
      ...(tsPlugin ? { "@typescript-eslint": tsPlugin } : {}),
    },
    rules: {
      // Relax rules that block deployment
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "react/no-unescaped-entities": "off",
    },
  },
];

export default eslintConfig;
