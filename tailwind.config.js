/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#FD6F2F',
          cream: '#FFEAD1',
          sage: '#DCE4B8',
          olive: '#515739',
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
          border: 'var(--color-border)',
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
