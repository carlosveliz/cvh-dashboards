/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // BioNet corporate palette, driven by CSS variables (HSL).
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
        "success-soft": "hsl(var(--success-soft))",
        danger: "hsl(var(--danger))",
        "danger-soft": "hsl(var(--danger-soft))",
        warning: "hsl(var(--warning))",
        // Dark institutional shell
        dark: "hsl(var(--dark))",
        "dark-2": "hsl(var(--dark-2))",
        "dark-fg": "hsl(var(--dark-fg))",
        "dark-muted-fg": "hsl(var(--dark-muted-fg))",
      },
      fontFamily: {
        sans: ["Montserrat", "system-ui", "sans-serif"],
        display: ["Montserrat", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0, 36, 64, 0.05), 0 10px 30px rgba(0, 36, 64, 0.08)",
        glow: "0 8px 40px rgba(0, 124, 183, 0.35)",
      },
    },
  },
  plugins: [],
};
