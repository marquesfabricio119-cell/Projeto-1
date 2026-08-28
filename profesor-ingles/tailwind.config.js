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
        xl: 'calc(var(--radius) + 0.35rem)',
        '2xl': 'calc(var(--radius) + 0.75rem)',
      },
      fontFamily: {
        heading: ['Poppins', 'Segoe UI', 'system-ui', '-apple-system', 'Helvetica Neue', 'Arial', 'sans-serif'],
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px hsl(20 14% 12% / 0.04), 0 8px 24px -12px hsl(20 14% 12% / 0.12)',
        lift: '0 2px 6px hsl(20 14% 12% / 0.06), 0 18px 40px -18px hsl(20 14% 12% / 0.22)',
      },
      keyframes: {
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.45' },
          '40%': { transform: 'translateY(-4px)', opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        'dot-bounce': 'dot-bounce 1.2s infinite ease-in-out',
        'fade-up': 'fade-up 0.25s ease-out both',
        'sheet-up': 'sheet-up 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
