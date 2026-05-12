import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        poker: {
          purple: "#7C5CFF",
          "purple-dark": "#6344E8",
          "purple-dim": "#1E1A3A",
          blue: "#5EA8FF",
          gold: "#ffd700",
          red: "#e53935",
          card: "#1c1c1e",
          /* kept for replay table */
          green: "#00c853",
          "green-dark": "#00a040",
          "green-dim": "#1a3d26",
          felt: "#0d1f0d",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "pulse-green": "pulse-green 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-green": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "purple-glow":
          "radial-gradient(ellipse at top, rgba(124,92,255,0.15) 0%, transparent 60%)",
        "purple-gradient":
          "linear-gradient(135deg, #7C5CFF 0%, #5EA8FF 100%)",
        /* kept for replay table */
        "felt-pattern":
          "radial-gradient(ellipse at center, #0d2414 0%, #0a0f0a 100%)",
        "hero-gradient":
          "linear-gradient(135deg, #0a0f0a 0%, #0d1f0d 50%, #0a0f0a 100%)",
        "card-gradient":
          "linear-gradient(145deg, #1a2b1a 0%, #111811 100%)",
        "green-glow":
          "radial-gradient(ellipse at top, rgba(0,200,83,0.15) 0%, transparent 60%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
