/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        fusha: {
          teal: {
            900: '#0B1A1B',
            800: '#163134', // Hero Primary
            700: '#1E4347',
            600: '#28565B',
            500: '#37695C', // Arabic Forest Emerald
            400: '#4E8777',
            100: '#D8EBE7',
            50:  '#EEF7F5',
          },
          sage: {
            600: '#4D6B54',
            500: '#62856A', // Olive & Sage Mid
            400: '#7AA482',
            100: '#E5EFE7',
          },
          olive: {
            500: '#798963',
            400: '#92A578',
            100: '#EDF1E8',
          },
          gold: {
            700: '#B88422',
            500: '#E8B54A', // Accent Action
            400: '#F0C76C',
            100: '#FDF6E2',
          },
          brass: {
            700: '#747043',
            600: '#918D58',
            400: '#B1AC6E',
          },
          sand: {
            500: '#99937E',
            300: '#B7B19B', // Logo Accent Dot
            100: '#E8E5DC',
            50:  '#F6F5F2',
          },
          canvas: {
            light: '#F8F9F7',
            dark: '#0B1A1B',
          },
        },
      },
      fontFamily: {
        fusha: ['Avenir Arabic', 'Cairo', 'IBM Plex Sans Arabic', 'sans-serif'],
        poetry: ['Amiri', 'Noto Naskh Arabic', 'serif'],
      },
      borderRadius: {
        'fusha-sm': '6px',
        'fusha-md': '12px',
        'fusha-lg': '20px',
        'fusha-xl': '32px',
      },
      boxShadow: {
        'fusha-sm': '0 1px 3px rgba(22, 49, 52, 0.06), 0 1px 2px rgba(22, 49, 52, 0.04)',
        'fusha-md': '0 4px 12px rgba(22, 49, 52, 0.08), 0 2px 4px rgba(22, 49, 52, 0.04)',
        'fusha-lg': '0 12px 24px -4px rgba(22, 49, 52, 0.12), 0 4px 8px -2px rgba(22, 49, 52, 0.04)',
        'fusha-floating': '0 20px 32px -6px rgba(22, 49, 52, 0.16), 0 8px 16px -4px rgba(22, 49, 52, 0.08)',
      },
    },
  },
};
