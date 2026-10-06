/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1e3a8a', // Collegiate Navy
          dark: '#00236f',
          hover: '#1e40af',
          active: '#172554',
          container: '#1e3a8a',
          light: '#e5eeff',
          tint: '#4059aa',
        },
        secondary: {
          DEFAULT: '#0f172a', // Deep Slate
          dark: '#0b1c30',
          muted: '#565e74',
          slate: '#475569',
        },
        tertiary: {
          DEFAULT: '#2563eb', // Tertiary Blue
          dark: '#00246b',
          light: '#dbe1ff',
        },
        surface: {
          canvas: '#f8fafc',
          bright: '#f8f9ff',
          dim: '#cbdbf5',
          lowest: '#ffffff',
          low: '#eff4ff',
          DEFAULT: '#f8fafc',
          container: '#e5eeff',
          high: '#dce9ff',
          highest: '#d3e4fe',
        },
        border: {
          subtle: '#f1f5f9',
          DEFAULT: '#e2e8f0',
          strong: '#cbd5e1',
          focus: '#2563eb',
        },
        academic: {
          success: {
            DEFAULT: '#059669',
            bg: '#ecfdf5',
            border: '#a7f3d0',
            text: '#065f46',
          },
          warning: {
            DEFAULT: '#d97706',
            bg: '#fffbeb',
            border: '#fde68a',
            text: '#92400e',
          },
          danger: {
            DEFAULT: '#dc2626',
            bg: '#fef2f2',
            border: '#fecaca',
            text: '#991b1b',
          },
          inactive: {
            DEFAULT: '#475569',
            bg: '#f1f5f9',
            border: '#cbd5e1',
            text: '#475569',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '4px',
        md: '4px',
        lg: '8px',
        xl: '12px',
        full: '9999px',
      },
      boxShadow: {
        'layer-1': '0 1px 3px 0 rgba(15, 23, 42, 0.05)',
        'layer-2': '0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
        'layer-3': '0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 10px 10px -5px rgba(15, 23, 42, 0.04)',
      },
      spacing: {
        'xs': '4px',
        'sm': '6px',
        'md': '12px',
        'lg': '20px',
        'xl': '28px',
      },
    },
  },
  plugins: [],
}
