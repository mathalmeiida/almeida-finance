/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ─── Dark mode ───
      // A escala "gray" foi invertida (claro ↔ escuro) para converter toda a
      // interface em tema escuro sem editar cada tela: os tons antes claros
      // (50–200), usados como fundos/cards/bordas, agora são escuros; os tons
      // antes escuros (700–900), usados em textos, agora são claros.
      colors: {
        gray: {
          50:  '#0d1117',       // fundo principal (quase preto)
          100: '#1c2128',       // superfícies / cards / hovers
          200: '#2d333b',       // bordas discretas / hovers de botão secundário
          300: '#444c56',       // bordas de inputs / divisores
          400: '#768390',       // texto secundário / ícones apagados
          500: '#909dab',       // texto secundário
          600: '#adbac7',       // texto secundário mais forte
          700: '#cdd9e5',       // texto de labels
          800: '#e6edf3',       // texto forte
          900: '#f0f6fc',       // texto principal (quase branco)
        },
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        }
      },
      // "bg-white" (fundo de cards/modais/notificações) vira o cinza-escuro das
      // superfícies. "text-white" continua branco de verdade, pois textColor
      // não é alterado aqui.
      backgroundColor: {
        white: '#161b22',
      },
    },
  },
  plugins: [],
}
