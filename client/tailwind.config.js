/** @type {import('tailwindcss').Config} */

function withOpacity(variable) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `hsl(var(${variable}) / ${opacityValue})`;
    }
    return `hsl(var(${variable}))`;
  };
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: withOpacity('--background'),
        foreground: withOpacity('--foreground'),
        card: {
          DEFAULT: withOpacity('--card'),
          foreground: withOpacity('--card-foreground'),
        },
        primary: {
          DEFAULT: withOpacity('--primary'),
          foreground: withOpacity('--primary-foreground'),
        },
        secondary: {
          DEFAULT: withOpacity('--secondary'),
          foreground: withOpacity('--secondary-foreground'),
        },
        muted: {
          DEFAULT: withOpacity('--muted'),
          foreground: withOpacity('--muted-foreground'),
        },
        accent: {
          DEFAULT: withOpacity('--accent'),
          foreground: withOpacity('--accent-foreground'),
        },
        destructive: withOpacity('--destructive'),
        success: withOpacity('--success'),
        danger: withOpacity('--danger'),
        border: withOpacity('--border'),
        ring: withOpacity('--ring'),
      },
      borderRadius: {
        lg: 'var(--radius)',
        xl: '1rem',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #C9A84C 0%, #E8D48B 50%, #C9A84C 100%)',
      },
      boxShadow: {
        'gold-sm': '0 2px 8px rgba(201, 168, 76, 0.1)',
        'gold-md': '0 4px 16px rgba(201, 168, 76, 0.15)',
        'gold-lg': '0 8px 32px rgba(201, 168, 76, 0.2)',
      },
    },
  },
  plugins: [],
};
