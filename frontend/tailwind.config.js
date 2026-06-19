/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Pastel, sophisticated palette driven by CSS variables (HSL).
        bg: "hsl(var(--bg))",
        surface: "hsl(var(--surface))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        "muted-fg": "hsl(var(--muted-fg))",
        fg: "hsl(var(--fg))",
        primary: "hsl(var(--primary))",
        "primary-fg": "hsl(var(--primary-fg))",
        "primary-soft": "hsl(var(--primary-soft))",
        accent: "hsl(var(--accent))",
        "accent-soft": "hsl(var(--accent-soft))",
        success: "hsl(var(--success))",
        danger: "hsl(var(--danger))",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px rgba(16, 24, 40, 0.06)",
      },
    },
  },
  plugins: [],
};
