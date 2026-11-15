import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ["src/lib/og-grid.tsx"], rules: { "@next/next/no-img-element": "off" } },
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        ...["Literal[value=/\\u00b7/]", "TemplateElement[value.raw=/\\u00b7/]", "JSXText[value=/\\u00b7/]"].map(selector => ({
          selector,
          message: "Separate items with spacing or commas, never a middle dot.",
        })),
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "data/**",
    "**/.venv/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
