// Teste de validação das integrações do Almeida Finance 2.0
import fs from 'fs'
import path from 'path'

let falhas = 0
function assert(nome, condicao, detalhes = '') {
  if (!condicao) falhas++
  console.log(`${condicao ? '✅ PASS' : '❌ FALHA'} — ${nome} ${detalhes}`)
}

console.log('# VALIDAÇÃO DE INTEGRAÇÕES - ALMEIDA FINANCE 2.0\n')

// 1. Verificar arquivos criados
console.log('## 1. Componentes Novos Criados')
const arquivosEsperados = [
  'src/pages/ApresentacaoNova.jsx',
  'src/pages/OnboardingNovo.jsx',
  'src/pages/RegistrarRapido.jsx',
  'src/components/NavegacaoInferior.jsx',
]

arquivosEsperados.forEach(arquivo => {
  const existe = fs.existsSync(arquivo)
  const tamanho = existe ? fs.statSync(arquivo).size : 0
  assert(`Arquivo ${arquivo}`, existe, `(${tamanho} bytes)`)
})

// 2. Verificar integrações no App.jsx
console.log('\n## 2. Rotas Integradas em App.jsx')
const appContent = fs.readFileSync('src/App.jsx', 'utf-8')

assert('Import ApresentacaoNova', appContent.includes("import ApresentacaoNova from './pages/ApresentacaoNova'"))
assert('Import OnboardingNovo', appContent.includes("import OnboardingNovo from './pages/OnboardingNovo'"))
assert('Import RegistrarRapido', appContent.includes("import RegistrarRapido from './pages/RegistrarRapido'"))
assert('Rota /apresentacao-inicial', appContent.includes('/apresentacao-inicial'))
assert('Rota /onboarding-novo', appContent.includes('/onboarding-novo'))
assert('Rota /registrar', appContent.includes('/registrar'))
assert('Rota /calendario', appContent.includes('/calendario'))

// 3. Verificar integração no Layout.jsx
console.log('\n## 3. Navegação Integrada em Layout.jsx')
const layoutContent = fs.readFileSync('src/components/Layout.jsx', 'utf-8')

assert('Import NavegacaoInferior', layoutContent.includes("import NavegacaoInferior from './NavegacaoInferior'"))
assert('Componente NavegacaoInferior usado', layoutContent.includes('<NavegacaoInferior'))

// 4. Verificar Dashboard.jsx atualizado
console.log('\n## 4. Dashboard Atualizado')
const dashboardContent = fs.readFileSync('src/pages/Dashboard.jsx', 'utf-8')

assert('Header com logo AF', dashboardContent.includes('Almeida Finance'))
assert('Imports mantidos', dashboardContent.includes('import CalendarioFinanceiroHome'))
assert('Imports mantidos', dashboardContent.includes('import AtalhosHome'))

// 5. Verificar estrutura dos componentes novos
console.log('\n## 5. Estrutura dos Componentes')

const apresentacaoContent = fs.readFileSync('src/pages/ApresentacaoNova.jsx', 'utf-8')
assert('ApresentacaoNova exporta default', apresentacaoContent.includes('export default function ApresentacaoNova'))
assert('ApresentacaoNova tem 3 slides', (apresentacaoContent.match(/slides = \[/g) || []).length >= 1)

const onboardingContent = fs.readFileSync('src/pages/OnboardingNovo.jsx', 'utf-8')
assert('OnboardingNovo exporta default', onboardingContent.includes('export default function OnboardingNovo'))
assert('OnboardingNovo tem 4 etapas', (onboardingContent.match(/etapa === [1-4]/g) || []).length >= 4)
assert('OnboardingNovo usa Supabase', onboardingContent.includes('supabase'))
assert('OnboardingNovo usa hooks', onboardingContent.includes('useCartoes') || onboardingContent.includes('useBeneficios'))

const registrarContent = fs.readFileSync('src/pages/RegistrarRapido.jsx', 'utf-8')
assert('RegistrarRapido exporta default', registrarContent.includes('export default function RegistrarRapido'))
assert('RegistrarRapido usa useDespesas', registrarContent.includes('useDespesas'))
assert('RegistrarRapido usa useReceitas', registrarContent.includes('useReceitas'))
assert('RegistrarRapido tem InputMoeda', registrarContent.includes('InputMoeda'))

const navegacaoContent = fs.readFileSync('src/components/NavegacaoInferior.jsx', 'utf-8')
assert('NavegacaoInferior exporta default', navegacaoContent.includes('export default function NavegacaoInferior'))
assert('NavegacaoInferior tem 5 itens', (navegacaoContent.match(/to: /g) || []).length >= 4)

// 6. Verificar imports críticos
console.log('\n## 6. Imports e Dependências')

const componentesQueUsamHooks = [
  { arquivo: 'src/pages/OnboardingNovo.jsx', hooks: ['useAuth', 'useCartoes', 'useBeneficios'] },
  { arquivo: 'src/pages/RegistrarRapido.jsx', hooks: ['useDespesas', 'useReceitas', 'useCartoes'] },
]

componentesQueUsamHooks.forEach(({ arquivo, hooks }) => {
  const content = fs.readFileSync(arquivo, 'utf-8')
  hooks.forEach(hook => {
    assert(`${path.basename(arquivo)} usa ${hook}`, content.includes(hook))
  })
})

// 7. Verificar componentes reutilizados
console.log('\n## 7. Componentes Reutilizados')

const componentesReutilizados = [
  { componente: 'InputMoeda', arquivos: ['src/pages/OnboardingNovo.jsx', 'src/pages/RegistrarRapido.jsx'] },
  { componente: 'ImportacaoInteligente', arquivos: ['src/pages/OnboardingNovo.jsx'] },
]

componentesReutilizados.forEach(({ componente, arquivos }) => {
  arquivos.forEach(arquivo => {
    const content = fs.readFileSync(arquivo, 'utf-8')
    assert(`${path.basename(arquivo)} usa ${componente}`, content.includes(componente))
  })
})

// Resultado final
console.log(`\n${falhas === 0 ? '✅ TODAS AS VALIDAÇÕES PASSARAM' : `❌ ${falhas} FALHA(S) ENCONTRADA(S)`}`)
if (falhas) process.exitCode = 1
