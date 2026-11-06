# 🔒 TESTES AUTOMATIZADOS DE RLS

## Sobre os Testes

Este projeto inclui uma suíte completa de testes automatizados para Row Level Security (RLS) utilizando **pgTAP**, o framework oficial de testes do PostgreSQL.

**Arquivo:** `supabase/tests/rls-security.test.sql`  
**Total de testes:** 60 testes automatizados  
**Cobertura:** 12 tabelas + acesso anônimo + consultoria

---

## 📋 O Que É Testado

### Tabelas com Isolamento Completo
Cada tabela é testada para:
- ✅ **SELECT:** Usuário vê apenas seus próprios dados
- ✅ **INSERT:** Usuário cria apenas para si mesmo
- ✅ **UPDATE:** Usuário atualiza apenas seus dados
- ✅ **DELETE:** Usuário deleta apenas seus dados
- ✅ **Acesso Anônimo:** Sem auth, não vê nada

**Tabelas testadas:**
1. `perfis` - Perfil do usuário
2. `receitas` - Receitas financeiras
3. `despesas` - Despesas
4. `cartoes` - Cartões de crédito
5. `metas` - Metas financeiras
6. `investimentos` - Investimentos
7. `beneficios` - Benefícios (VR/VA)
8. `parcelamentos` - Parcelamentos
9. `compras_cartao` - Compras no cartão
10. `despesas_tipo_excecoes` - Exceções de tipos
11. `faturas_cartao_informadas` - Faturas informadas
12. `movimentacoes_beneficios` - Movimentações VR/VA

### Casos Especiais

#### Categorias (Leitura Pública)
- ✅ Qualquer um (até anônimo) pode ler
- ✅ Apenas admin (service_role) pode escrever

#### Consultorias (Permissões Específicas)
- ✅ Cliente vê acessos concedidos
- ✅ Consultor vê acessos recebidos
- ✅ Terceiros não vêem relações alheias

---

## 🚀 Como Executar

### Pré-requisitos

1. **Instalar pgTAP no banco de dados:**
   ```sql
   -- No SQL Editor do Supabase Dashboard
   CREATE EXTENSION IF NOT EXISTS pgtap;
   ```

2. **Verificar instalação:**
   ```sql
   SELECT * FROM pg_available_extensions WHERE name = 'pgtap';
   ```

### Método 1: Supabase CLI (Recomendado)

```bash
# 1. Instalar Supabase CLI (se não tiver)
npm install -g supabase

# 2. Executar testes
supabase test db

# 3. Ver resultados detalhados
supabase test db --verbose
```

### Método 2: SQL Editor (Dashboard)

1. Copiar o conteúdo de `supabase/tests/rls-security.test.sql`
2. Abrir SQL Editor no Dashboard Supabase
3. Colar e clicar em **Run**
4. Verificar output (esperado: **60/60 testes passando**)

### Método 3: psql (Linha de Comando)

```bash
# Conectar ao banco
psql -h db.SEU_PROJETO_ID.supabase.co \
     -U postgres \
     -d postgres \
     -f supabase/tests/rls-security.test.sql
```

---

## 📊 Estrutura dos Testes

### Formato pgTAP

```sql
-- Exemplo de teste
SELECT ok(
  NOT EXISTS(SELECT 1 FROM receitas WHERE id = 'receita_de_outro_usuario'),
  'Alice NÃO vê receita de Bob'
);
```

### Helpers de Autenticação

```sql
-- Simular usuário autenticado
SELECT tests.set_auth_uid('uuid_do_usuario');

-- Limpar autenticação (anônimo)
SELECT tests.clear_auth();
```

### Fluxo de Cada Teste

1. **Setup:** Criar dados de teste (service_role)
2. **Autenticar:** Simular usuário específico
3. **Testar:** Executar operação e verificar resultado
4. **Limpar:** Remover dados de teste

---

## ✅ Resultado Esperado

### Output Sucesso

```
1..60
ok 1 - Alice vê seu próprio perfil
ok 2 - Alice NÃO vê perfil de Bob
ok 3 - Alice vê apenas 1 receita (a dela)
...
ok 59 - Bob NÃO vê movimentação de benefício de Alice
ok 60 - Limpeza completa dos dados de teste
```

**Interpretação:**
- **`1..60`** = Total de testes planejados
- **`ok N`** = Teste N passou
- **`not ok N`** = Teste N falhou (CRÍTICO!)

### Output Falha (Exemplo)

```
1..60
ok 1 - Alice vê seu próprio perfil
not ok 2 - Alice NÃO vê perfil de Bob
# Failed test 2: "Alice NÃO vê perfil de Bob"
# Expected: 0 rows
# Got: 1 row
```

**⚠️ SE ALGUM TESTE FALHAR:**
1. RLS está configurado INCORRETAMENTE
2. **NÃO PUBLICAR** até corrigir
3. Revisar políticas RLS no banco de dados

---

## 🔍 Detalhes Técnicos

### Como Funciona a Simulação de Usuários?

```sql
-- Helper cria claim JWT fake
CREATE OR REPLACE FUNCTION tests.set_auth_uid(uid uuid) RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', 
                     json_build_object('sub', uid::text)::text, 
                     true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Em produção:** `auth.uid()` usa JWT real do Supabase Auth  
**Em testes:** Simulamos com `request.jwt.claims`

### Por Que Usar service_role para Setup?

```sql
SET LOCAL role service_role;
INSERT INTO receitas (...) VALUES (...);
RESET role;
```

- `service_role` bypassa RLS (apenas para preparação)
- Simula estado inicial do banco
- Testes executam com roles de usuário comum

---

## 🛡️ Cobertura de Segurança

### ✅ Testes Positivos (Devem Passar)
- Usuário vê seus dados
- Usuário cria para si mesmo
- Usuário atualiza seus dados
- Usuário deleta seus dados

### ✅ Testes Negativos (Devem Falhar)
- Usuário NÃO vê dados de outro
- Usuário NÃO cria para outro
- Usuário NÃO atualiza dados de outro
- Usuário NÃO deleta dados de outro

### ✅ Testes de Acesso Anônimo
- Sem autenticação, não vê nada (exceto categorias públicas)

---

## 🔧 Troubleshooting

### Erro: "function set_auth_uid does not exist"

**Solução:** Criar schema `tests` primeiro:

```sql
CREATE SCHEMA IF NOT EXISTS tests;
```

### Erro: "extension pgtap is not available"

**Solução:** Instalar pgTAP:

```sql
CREATE EXTENSION IF NOT EXISTS pgtap;
```

Se não funcionar, verificar com Supabase Support se pgTAP está habilitado no plano.

### Erro: "new row violates row-level security policy"

**Interpretação:**
- Se erro acontece em teste **negativo** → ✅ **CORRETO** (RLS bloqueou)
- Se erro acontece em teste **positivo** → ❌ **FALHA** (RLS bloqueou indevidamente)

---

## 📈 Integração Contínua

### GitHub Actions (Exemplo)

```yaml
name: RLS Tests
on: [push, pull_request]

jobs:
  test-rls:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: supabase test db
```

---

## 📝 Manutenção

### Adicionar Nova Tabela

1. Criar testes em `rls-security.test.sql`:
   ```sql
   -- TESTE: NOVA_TABELA - Isolamento
   SET LOCAL role service_role;
   INSERT INTO nova_tabela (...) VALUES (...);
   RESET role;
   
   SELECT tests.set_auth_uid('bob_id');
   SELECT ok(
     NOT EXISTS(SELECT 1 FROM nova_tabela WHERE id = 'alice_data_id'),
     'Bob NÃO vê dados de Alice na nova_tabela'
   );
   ```

2. Atualizar `SELECT plan(N)` com novo total de testes

3. Executar e verificar

---

## 🎯 Quando Executar

### Obrigatório
- ✅ Antes de cada deploy para produção
- ✅ Após mudanças em políticas RLS
- ✅ Após adicionar/remover tabelas
- ✅ Após migrar dados

### Recomendado
- ✅ A cada commit (CI/CD)
- ✅ Semanalmente (monitoramento)
- ✅ Após atualizar Supabase

---

## ⚠️ Limitações Conhecidas

### O Que NÃO É Testado

1. **Storage (arquivos):** Requer testes separados
2. **Realtime subscriptions:** Requer testes de integração
3. **Edge Functions:** Testadas separadamente
4. **Views complexas:** Apenas tabelas base
5. **Triggers:** Lógica de negócio testada em outros suítes

### Diferenças vs Produção

- **JWT simulado** vs JWT real do Supabase Auth
- **Transação ROLLBACK** vs dados persistentes
- **UUIDs fixos** vs UUIDs gerados dinamicamente

Apesar disso, os testes **são válidos** porque testam as políticas RLS PostgreSQL, que funcionam da mesma forma em produção.

---

## 📚 Referências

- [pgTAP Official Documentation](https://pgtap.org/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/database/extensions/pgtap)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)

---

**Última atualização:** 06 de Novembro de 2026  
**Versão dos testes:** 1.0.0  
**Status:** ⚠️ Aguarda execução inicial
