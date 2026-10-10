/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ─── Tema CLARO ───
      // A escala "gray" voltou ao padrão do Tailwind (tons claros em cima,
      // escuros embaixo). Antes ela era invertida para simular um tema escuro;
      // agora o app é claro: fundos claros (50–200), textos escuros (700–900).
      // Como todas as telas usam bg-gray-50 / bg-white / text-gray-900, restaurar
      // a escala aqui clareia o app inteiro sem editar cada componente.
      colors: {
        gray: {
          50:  '#f8fafc',   // fundo principal das telas (#F8FAFC pedido)
          100: '#f1f5f9',   // superfícies claras / hovers
          200: '#e2e8f0',   // bordas discretas / divisores
          300: '#cbd5e1',   // bordas de inputs
          400: '#94a3b8',   // texto secundário / ícones apagados
          500: '#64748b',   // texto secundário
          600: '#475569',   // texto secundário mais forte
          700: '#334155',   // texto de labels
          800: '#1e293b',   // texto forte
          900: '#0f172a',   // texto principal (quase preto)
        },
        // Azul utilitário mantido (compatibilidade com classes primary-*).
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
        },
        // ─── Cor de MARCA (Azul padrão / Rosa) ───
        // Controlada por variáveis CSS definidas no :root (ver index.css) e
        // alternadas pela preferência do usuário (Fase 2). Usar bg-marca,
        // text-marca, border-marca, etc. nos elementos de AÇÃO/DESTAQUE.
        marca: {
          DEFAULT: 'rgb(var(--marca) / <alpha-value>)',
          hover:   'rgb(var(--marca-hover) / <alpha-value>)',
          50:      'rgb(var(--marca) / 0.08)',
          100:     'rgb(var(--marca) / 0.12)',
          150:     'rgb(var(--marca) / 0.16)',
          200:     'rgb(var(--marca) / 0.22)',
        },
      },
      // "bg-white" volta a ser branco de verdade (#FFFFFF) — cards, modais e
      // notificações. textColor "white" segue branco (usado sobre fundos de cor).
      backgroundColor: {
        white: '#ffffff',
      },
    },
  },
  plugins: [],
}
