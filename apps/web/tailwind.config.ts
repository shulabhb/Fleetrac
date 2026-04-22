import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0b1220",
          800: "#111827",
          700: "#1f2937",
          600: "#374151",
          500: "#4b5563",
          400: "#6b7280",
          300: "#9ca3af",
          200: "#d1d5db",
          100: "#e5e7eb",
          50: "#f3f4f6"
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f8fafc",
          subtle: "#f1f5f9"
        },
        border: {
          DEFAULT: "#e2e8f0",
          strong: "#cbd5e1"
        },
        severity: {
          high: "#b91c1c",
          mediumForeground: "#b45309",
          low: "#15803d"
        }
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Inter",
          "sans-serif"
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }]
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 1px 0 rgba(15, 23, 42, 0.03)",
        "card-hover": "0 4px 12px -4px rgba(15, 23, 42, 0.12), 0 2px 4px 0 rgba(15, 23, 42, 0.05)"
      },
      borderRadius: {
        lg: "0.625rem"
      }
    }
  },
  plugins: []
};

export default config;
