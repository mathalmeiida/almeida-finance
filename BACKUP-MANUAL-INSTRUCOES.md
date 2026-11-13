# BACKUP MANUAL — Almeida Finance 2.0

**Data:** 06/11/2026  
**Projeto:** ievccupeijzuzhomphwn  
**Plano:** Free (SEM backups automaticos)  
**Criticidade:** ALTA (backup obrigatorio antes de aplicar migration RPC)

---

## SITUACAO ATUAL

**Problema identificado:**
- Projeto no plano Supabase Free
- Backups automaticos NAO disponivel no plano Free
- Ferramentas de backup nao instaladas localmente (pg_dump, supabase CLI)

**Riscos sem backup:**
- Migration altera funcao RPC que executa DELETEs em 17 tabelas
- Erro na aplicacao pode deixar funcionalidade inacessivel
- Nao ha como reverter alteracoes no plano Free

**Necessidade:**
- Criar backup manual ANTES de aplicar a migration
- Validar integridade do backup
- Garantir capacidade de restauracao

---

## OPCOES DE BACKUP

### OPCAO 1: Backup via Supabase Dashboard (RECOMENDADO)

**Metodo:** Exportar dados via SQL Editor

**Passos:**

1. **Acessar Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/ievccupeijzuzhomphwn
   ```

2. **Abrir SQL Editor:**
   ```
   Menu lateral > SQL Editor > New query
   ```

3. **Exportar Schema + Dados (executar queries separadamente):**

   **Query 1: Exportar definicoes de tabelas**
   ```sql
   -- Colar no SQL Editor e executar
   SELECT 
     'CREATE TABLE IF NOT EXISTS ' || 
     schemaname || '.' || tablename || ' (' ||
     array_to_string(
       ARRAY(
         SELECT column_name || ' ' || data_type || 
           CASE WHEN character_maximum_length IS NOT NULL 
                THEN '(' || character_maximum_length || ')' 
                ELSE '' 
           END ||
           CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END
         FROM information_schema.columns
         WHERE table_schema = schemaname 
           AND table_name = tablename
         ORDER BY ordinal_position
       ), ', '
     ) || ');' AS create_statement
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY tablename;
   ```
   
   **Copiar resultado e salvar em:** `backups/2026-11-06_schema_tabelas.sql`

   **Query 2: Exportar dados de cada tabela (exemplo para perfis)**
   ```sql
   -- Para cada tabela financeira, executar:
   COPY (SELECT * FROM public.perfis) TO STDOUT WITH CSV HEADER;
   ```
   
   **Nota:** Supabase Dashboard nao suporta COPY TO STDOUT diretamente.
   
   **Alternativa: Exportar via SELECT**
   ```sql
   -- Executar para cada tabela e copiar resultados
   SELECT * FROM public.perfis;
   SELECT * FROM public.categorias;
   SELECT * FROM public.receitas;
   SELECT * FROM public.despesas;
   SELECT * FROM public.parcelamentos;
   SELECT * FROM public.metas;
   SELECT * FROM public.cartoes;
   SELECT * FROM public.compras_cartao;
   -- ... (demais tabelas)
   ```

**Limitacoes:**
- Trabalhoso (17+ tabelas)
- Nao exporta funcoes, triggers, policies automaticamente
- Requer copia manual de cada resultado

**Tempo estimado:** 30-60 minutos

---

### OPCAO 2: Instalar Supabase CLI + pg_dump (MELHOR PRATICA)

**Metodo:** Usar ferramentas oficiais para backup completo

**Passos:**

1. **Instalar Supabase CLI:**
   ```powershell
   # Via Scoop (recomendado no Windows)
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   
   # OU via npm
   npm install -g supabase
   ```

2. **Instalar PostgreSQL (para pg_dump):**
   ```powershell
   # Via Scoop
   scoop install postgresql
   
   # OU baixar do site oficial
   # https://www.postgresql.org/download/windows/
   ```

3. **Login no Supabase:**
   ```powershell
   supabase login
   ```

4. **Obter string de conexao:**
   ```
   Supabase Dashboard > Settings > Database > Connection string
   Copiar: "Connection pooling" (modo Transaction)
   ```

5. **Criar backup completo:**
   ```powershell
   # Formato custom (comprimido, permite restauracao seletiva)
   pg_dump "postgresql://postgres.ievccupeijzuzhomphwn:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" `
     --file="backups/2026-11-06_producao_completo.backup" `
     --format=custom `
     --verbose `
     --no-owner `
     --no-acl
   
   # OU formato SQL puro (legivel, maior tamanho)
   pg_dump "postgresql://postgres.ievccupeijzuzhomphwn:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" `
     --file="backups/2026-11-06_producao_completo.sql" `
     --format=plain `
     --verbose `
     --no-owner `
     --no-acl
   ```

6. **Validar backup:**
   ```powershell
   # Verificar tamanho do arquivo
   Get-Item backups/2026-11-06_producao_completo.backup | Select-Object Length, LastWriteTime
   
   # Listar conteudo do backup (formato custom)
   pg_restore --list backups/2026-11-06_producao_completo.backup
   ```

**Vantagens:**
- Backup completo (schema + dados + funcoes + policies + triggers)
- Automatizado e rapido
- Formato comprimido
- Facil de restaurar

**Tempo estimado:** 10-15 minutos (incluindo instalacao)

---

### OPCAO 3: Backup Programatico (Node.js)

**Metodo:** Script Node.js para exportar dados via Supabase Client

**Criar arquivo:** `scripts/backup-producao.mjs`

```javascript
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = 'https://ievccupeijzuzhomphwn.supabase.co'
const supabaseKey = 'sb_publishable_AEH_qoYHnbxDoQFvuPFAIA_5BHgY_ku' // Anon key

const supabase = createClient(supabaseUrl, supabaseKey)

const tabelas = [
  'perfis',
  'categorias',
  'receitas',
  'despesas',
  'parcelamentos',
  'metas',
  'cartoes',
  'compras_cartao',
  'faturas_cartao',
  'despesas_tipo_excecoes',
  'amortizacoes',
  'beneficios',
  'beneficios_movimentacoes',
  'investimentos',
  'investimentos_movimentacoes',
  'importacoes',
  'importacoes_itens'
]

const backup = {
  data: new Date().toISOString(),
  projeto: 'ievccupeijzuzhomphwn',
  versao: '1.0',
  tabelas: {}
}

async function exportarTabela(tabela) {
  console.log(`Exportando ${tabela}...`)
  
  const { data, error, count } = await supabase
    .from(tabela)
    .select('*', { count: 'exact' })
  
  if (error) {
    console.error(`Erro em ${tabela}:`, error)
    return { registros: 0, dados: [] }
  }
  
  console.log(`  ${count} registros exportados`)
  return { registros: count, dados: data }
}

async function main() {
  console.log('Iniciando backup de producao...\n')
  
  for (const tabela of tabelas) {
    backup.tabelas[tabela] = await exportarTabela(tabela)
  }
  
  const nomeArquivo = `backups/2026-11-06_producao_dados.json`
  fs.writeFileSync(nomeArquivo, JSON.stringify(backup, null, 2))
  
  const tamanho = (fs.statSync(nomeArquivo).size / 1024 / 1024).toFixed(2)
  console.log(`\nBackup concluido: ${nomeArquivo} (${tamanho} MB)`)
  
  // Resumo
  const totalRegistros = Object.values(backup.tabelas).reduce((acc, t) => acc + t.registros, 0)
  console.log(`Total de registros: ${totalRegistros}`)
}

main().catch(console.error)
```

**Executar:**
```powershell
# Criar pasta de backups
New-Item -ItemType Directory -Force -Path backups

# Executar script
node scripts/backup-producao.mjs
```

**Limitacoes:**
- Nao exporta funcoes, triggers, policies (apenas dados)
- RLS pode limitar acesso (anon key tem restricoes)
- Formato JSON (nao compativel com pg_restore)

**Vantagens:**
- Nao requer instalacao de ferramentas externas
- Rapido de implementar
- Backup dos dados em formato legivel

**Tempo estimado:** 5-10 minutos

---

## ESTRUTURA DE BACKUP RECOMENDADA

```
c:\Users\MATHEUS\Desktop\App Financas\backups\
├── 2026-11-06_producao_completo.backup   (pg_dump formato custom)
├── 2026-11-06_producao_completo.sql      (pg_dump formato SQL)
├── 2026-11-06_producao_dados.json        (script Node.js)
├── 2026-11-06_schema_tabelas.sql         (SQL Editor)
├── 2026-11-06_funcoes.sql                (exportar manualmente)
└── VALIDACAO.md                          (registro de validacao)
```

**Adicionar ao .gitignore:**
```
# Backups locais (nao versionar)
backups/
*.backup
*_producao_*.sql
*_producao_*.json
```

---

## VALIDACAO DO BACKUP

### Checklist de Validacao

**Arquivo gerado:**
- [ ] Backup existe e esta acessivel
- [ ] Tamanho maior que 0 bytes
- [ ] Data de criacao = hoje (06/11/2026)
- [ ] Nome do arquivo contem data e identificacao

**Conteudo do backup:**
- [ ] Contem definicoes de schema (CREATE TABLE)
- [ ] Contem dados das 17+ tabelas
- [ ] Contem definicao da funcao zerar_dados_financeiros() atual
- [ ] Contem policies RLS
- [ ] Contem triggers

**Integridade:**
- [ ] Arquivo nao esta corrompido
- [ ] Pode ser aberto/lido sem erros
- [ ] Contagem de registros confere com producao

### Teste de Restauracao (Opcional)

**Criar banco local de teste:**
```powershell
# Instalar PostgreSQL local (se ainda nao tiver)
scoop install postgresql

# Criar banco de teste
createdb almeida_finance_backup_test

# Restaurar backup
pg_restore --dbname=almeida_finance_backup_test --verbose backups/2026-11-06_producao_completo.backup

# OU se formato SQL
psql almeida_finance_backup_test < backups/2026-11-06_producao_completo.sql

# Validar restauracao
psql almeida_finance_backup_test -c "\dt"  # Listar tabelas
psql almeida_finance_backup_test -c "SELECT COUNT(*) FROM perfis;"
```

---

## REGISTRO DE VALIDACAO

**Criar arquivo:** `backups/VALIDACAO.md`

```markdown
# Validacao de Backup - 06/11/2026

## Informacoes do Backup

- Data/Hora: [preencher]
- Arquivo: [nome do arquivo]
- Tamanho: [tamanho em MB]
- Formato: [custom/SQL/JSON]
- Metodo: [pg_dump/script/manual]

## Conteudo Validado

- [ ] 17 tabelas financeiras
- [ ] Tabela perfis
- [ ] Funcao zerar_dados_financeiros()
- [ ] Policies RLS
- [ ] Triggers
- [ ] Constraints (FKs, CHECKs)

## Contagem de Registros

- perfis: [numero]
- receitas: [numero]
- despesas: [numero]
- cartoes: [numero]
- metas: [numero]
- (demais tabelas...)

Total de registros: [numero]

## Teste de Restauracao

- [ ] Backup restaurado em banco local sem erros
- [ ] Tabelas criadas corretamente
- [ ] Dados importados corretamente
- [ ] Funcoes e policies restauradas

## Status Final

- [ ] BACKUP APROVADO (pode aplicar migration)
- [ ] BACKUP REJEITADO (corrigir problemas antes de prosseguir)

## Observacoes

[Notas adicionais]
```

---

## RECOMENDACAO FINAL

**Para criar backup AGORA (RAPIDO):**
1. Usar OPCAO 3 (script Node.js) - 10 minutos
2. Complementar com export manual da funcao RPC atual

**Para criar backup COMPLETO (IDEAL):**
1. Instalar Supabase CLI + PostgreSQL (OPCAO 2)
2. Executar pg_dump com formato custom
3. Validar com pg_restore em banco local

**CRITICO:**
- NAO aplicar migration sem backup
- Salvar backup FORA do repositorio Git
- Validar integridade antes de prosseguir
- Documentar validacao em VALIDACAO.md

---

## PROXIMOS PASSOS

1. **Escolher metodo de backup** (OPCAO 2 recomendada)
2. **Criar backup** seguindo passos acima
3. **Validar backup** (checklist + teste de restauracao)
4. **Documentar validacao** (VALIDACAO.md)
5. **Aplicar migration** `2026-11-rpc_zerar_dados_financeiros_FINAL_LIMPO.sql`
6. **Testar funcionalidade** com conta ficticia

---

**IMPEDIMENTO ATUAL:**
- pg_dump nao instalado localmente
- Supabase CLI nao instalado localmente
- Requer instalacao de ferramentas OU uso de script Node.js

**Status:** AGUARDANDO escolha do metodo de backup e execucao
