/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        'card-foreground': 'hsl(var(--card-foreground) / <alpha-value>)',
        primary: 'hsl(var(--primary) / <alpha-value>)',
        'primary-foreground': 'hsl(var(--primary-foreground) / <alpha-value>)',
        muted: 'hsl(var(--muted) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
        accent: 'hsl(var(--accent) / <alpha-value>)',
        'accent-foreground': 'hsl(var(--accent-foreground) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        danger: 'hsl(var(--danger) / <alpha-value>)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 0.35rem)',
        sm: 'calc(var(--radius) - 0.6rem)',
        xl: 'calc(var(--radius) + 0.5rem)',
      },
      fontFamily: {
        display: ['Poppins', 'Segoe UI', 'system-ui', '-apple-system', 'Helvetica Neue', 'Arial', 'sans-serif'],
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px hsl(30 30% 40% / 0.06), 0 8px 24px -12px hsl(30 40% 30% / 0.18)',
        lift: '0 2px 6px hsl(30 30% 40% / 0.08), 0 18px 40px -18px hsl(30 40% 30% / 0.30)',
      },
      keyframes: {
        'ponto-digitando': {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.45' },
          '30%': { transform: 'translateY(-0.28rem)', opacity: '1' },
        },
        'entrada-suave': {
          from: { opacity: '0', transform: 'translateY(0.4rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'ponto-digitando': 'ponto-digitando 1.2s infinite ease-in-out',
        'entrada-suave': 'entrada-suave 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};
