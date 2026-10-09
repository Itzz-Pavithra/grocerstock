/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          mustard: '#D4A72C',
          charcoal: '#202124',
          paleBlue: '#B9DDE5',
          cream: '#F7F5EF',
          // Aliases for seamless system-wide adaptation
          orange: '#D4A72C',
          olive: '#202124',
          sage: '#B9DDE5',
        },
        mustard: {
          DEFAULT: '#D4A72C',
          50: '#FDF9EB',
          100: '#FBF2D4',
          200: '#F5E3A3',
          300: '#EFD472',
          400: '#E4BF45',
          500: '#D4A72C',
          600: '#B88E1E',
          700: '#8E6D15',
          800: '#644D0F',
          900: '#3D2F09',
        },
        charcoal: {
          DEFAULT: '#202124',
          50: '#F8F9FA',
          100: '#E8EAED',
          200: '#D2D5D9',
          300: '#9AA0A6',
          400: '#5F6368',
          500: '#3C4043',
          600: '#202124',
          700: '#1A1C1E',
          800: '#141517',
          900: '#0E0F10',
        },
        paleBlue: {
          DEFAULT: '#B9DDE5',
          50: '#F6FBFC',
          100: '#EBF6F9',
          200: '#DBEEF3',
          300: '#B9DDE5',
          400: '#91C8D4',
          500: '#68B0C0',
          600: '#4A92A2',
        },
        cream: {
          DEFAULT: '#F7F5EF',
          50: '#FFFEFB',
          100: '#FCFBF7',
          200: '#F7F5EF',
          300: '#EDE9DC',
          400: '#DDD8C4',
          500: '#C8C1A8',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          light: 'var(--color-primary-light)',
        },
        app: {
          bg: 'var(--color-bg)',
          card: 'var(--color-surface)',
          cardSubtle: 'var(--color-surface-subtle)',
          text: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          textMuted: 'var(--color-text-muted)',
          border: 'var(--color-border)',
          charcoal: 'var(--color-charcoal)',
          paleBlue: 'var(--color-pale-blue)',
          mustard: 'var(--color-mustard)',
        }
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
