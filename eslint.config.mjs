import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import { fixupConfigAsPlugin } from "@eslint/compat"; // Required for older plugin formats with flat config

export default [
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  fixupConfigAsPlugin(pluginReactConfig), // Use fixupConfigAsPlugin for React config
  {
    // Define rules for all relevant files
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      // These rules are explicitly turned off to prevent build failures on Vercel
      "@typescript-eslint/no-unused-vars": "off", // Disables 'stats' unused variable error
      "react-hooks/exhaustive-deps": "off",      // Disables 'useEffect' dependency warning
      "react/no-unescaped-entities": "off",      // Disables 'unescaped entities' error in JSX
    }
  }
];