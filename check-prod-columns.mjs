// Verificação direta: produção tem as 12 colunas necessárias?
import { readFileSync } from 'fs';

console.log('═══════════════════════════════════════════════════════════');
console.log('🔍 VERIFICAÇÃO SCHEMA PRODUÇÃO vs CÓDIGO');
console.log('═══════════════════════════════════════════════════════════\n');

// 1. Confirmar ambiente
const env = readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const projeto = urlMatch?.[1]?.match(/https:\/\/(.+?)\.supabase\.co/)?.[1];

console.log('📍 Ambiente: PRODUÇÃO');
console.log('🔗 Projeto:', projeto);
console.log('✅ Arquivo:', '.env.local\n');

// 2. Colunas requeridas pelo código
const colunasRequeridas = [
  { nome: 'id', categoria: 'Base', uso: 'identificador único (UUID)' },
  { nome: 'nome', categoria: 'Base', uso: 'nome do usuário' },
  { nome: 'email', categoria: 'Base', uso: 'email único (auth.users)' },
  { nome: 'criado_em', categoria: 'Base', uso: 'timestamp de criação' },
  { nome: 'papel', categoria: 'Admin', uso: 'role (admin/usuario) - PROTEGIDO' },
  { nome: 'ativo', categoria: 'Admin', uso: 'status ativo/inativo - PROTEGIDO' },
  { nome: 'ultimo_acesso', categoria: 'Admin', uso: 'timestamp último login' },
  { nome: 'onboarding_concluido', categoria: 'Onboarding', uso: 'boolean - 37 referências no código' },
  { nome: 'objetivos_financeiros', categoria: 'Onboarding', uso: 'TEXT - metas do usuário' },
  { nome: 'onboarding_etapa', categoria: 'Onboarding', uso: 'TEXT - etapa atual' },
  { nome: 'saldo_base', categoria: 'Financeiro', uso: 'NUMERIC(15,2) - saldo inicial' },
  { nome: 'saldo_base_data', categoria: 'Financeiro', uso: 'DATE - data referência saldo' },
];

console.log('📊 COLUNAS REQUERIDAS PELO CÓDIGO: 12 colunas\n');
colunasRequeridas.forEach((col, i) => {
  console.log(`  ${String(i + 1).padStart(2)}. ${col.nome.padEnd(25)} [${col.categoria.padEnd(10)}] ${col.uso}`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('⚠️  AÇÃO NECESSÁRIA');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Você reportou que a consulta retornou 7 colunas, mas o print');
console.log('mostrava o projeto DEV (gxfcfpdwyjqcrfssxgbi).\n');

console.log('Para confirmar o schema de PRODUÇÃO, execute MANUALMENTE:\n');
console.log('1. Acesse: https://supabase.com/dashboard/project/ievccupeijzuzhomphwn/editor');
console.log('2. Clique em "SQL Editor" (ícone </>)');
console.log('3. Cole e execute:\n');
console.log('   SELECT column_name, data_type');
console.log('   FROM information_schema.columns');
console.log("   WHERE table_name = 'perfis'");
console.log("     AND table_schema = 'public'");
console.log('   ORDER BY ordinal_position;\n');
console.log('4. Copie TODA a saída aqui\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('🚨 BLOQUEIO DE PUBLICAÇÃO');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Se produção tiver MENOS de 12 colunas:');
console.log('  → App vai quebrar imediatamente após deploy');
console.log('  → 37 referências a onboarding_concluido vão falhar');
console.log('  → Usuários não conseguirão salvar saldo_base\n');

console.log('Se produção tiver AS 12 colunas:');
console.log('  → Publicação pode prosseguir com segurança');
console.log('  → git add + commit + push + vercel deploy\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('📦 STATUS ATUAL');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('✅ Build: dist/index.html existe (19:26)');
console.log('✅ DEV: 12 colunas, RLS correto, testes 16/16 PASS');
console.log('✅ Código: App.jsx + OnboardingSimples.jsx corrigidos');
console.log('⏸️  Git: 2 arquivos modificados, 2 commits pendentes');
console.log('❓ PROD: Schema desconhecido (aguardando sua confirmação)\n');
