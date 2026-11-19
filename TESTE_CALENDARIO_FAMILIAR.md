# Teste do Calendário Familiar - Almeida Finance

## Pré-requisitos

Antes de testar o calendário familiar, as migrations devem estar aplicadas:

```bash
cd posso-comprar
supabase db push
```

Ou, em ambiente de produção (CUIDADO):
```sql
-- Aplicar manualmente no painel Supabase
-- 1. migrations/20261119000001_familia_whatsapp_base.sql
-- 2. migrations/20261119000002_perfis_security_fix.sql
```

## Estrutura do Calendário Familiar

### Interface
- **Toggle Pessoal/Familiar**: Aparece apenas para usuários Premium/Pro ou com plano_override
- **Modo Pessoal**: Exibe despesas, receitas, recorrências e cartões do usuário
- **Modo Familiar**: Exibe apenas divisões de despesas do grupo familiar

### Dados Exibidos

**Modo Pessoal:**
- Todas as despesas do mês atual
- Receitas do mês atual
- Despesas recorrentes
- Receitas recorrentes
- Faturas de cartão

**Modo Familiar:**
- Divisões de despesas do grupo
- Apenas a parte que o usuário deve (não o valor total)
- Status de pagamento da parte do usuário
- Quem pagou a despesa originalmente
- Não exibe receitas ou recorrências

## Casos de Teste

### 1. Usuário Free (sem acesso)
```
Dado: Usuário com subscription_plan = 'free'
Quando: Acessar /calendario
Então: 
  - Toggle familiar NÃO aparece
  - Exibe apenas calendário pessoal
  - Não há acesso a useFamilyGroups
```

### 2. Usuário Premium sem Grupo
```
Dado: Usuário com subscription_plan = 'premium'
E: Não pertence a nenhum grupo familiar
Quando: Acessar /calendario
Então:
  - Toggle familiar NÃO aparece (grupos.length === 0)
  - Exibe apenas calendário pessoal
```

### 3. Usuário Premium com Grupo
```
Dado: Usuário com subscription_plan = 'premium'
E: Pertence ao grupo "Almeida Família"
Quando: Acessar /calendario
Então:
  - Toggle "Pessoal | Almeida Família" aparece
  - Modo pessoal ativo por padrão
  - Calendário mostra despesas pessoais
```

### 4. Alternar para Modo Familiar
```
Dado: Usuário Premium no grupo "Almeida Família"
Quando: Clicar no toggle "Almeida Família"
Então:
  - modoFamilia = true
  - useFamilyExpenseSplits carrega divisões do grupo
  - Calendário mostra apenas divisões familiares
  - Cada divisão mostra:
    * Descrição da despesa
    * Valor que o USUÁRIO deve (não total)
    * Data de criação
    * Categoria
    * Nome de quem pagou
```

### 5. Divisão com Múltiplos Participantes
```
Dado: Divisão de R$ 300,00 (30000 centavos)
E: João deve R$ 150,00 (15000 centavos)
E: Maria deve R$ 150,00 (15000 centavos)
Quando: João acessa calendário familiar
Então:
  - Entrada mostra "R$ 150,00" (não R$ 300,00)
  - Entrada mostra status: pago=false
  - Entrada mostra "Pago por: Maria"

Quando: Maria acessa calendário familiar
Então:
  - Entrada mostra "R$ 150,00" (não R$ 300,00)
  - Entrada mostra status: pago=true (se ela pagou sua parte)
```

### 6. Navegação entre Meses
```
Dado: Divisões em janeiro e fevereiro
Quando: Navegar para janeiro
Então: Exibe apenas divisões de janeiro

Quando: Navegar para fevereiro
Então: Exibe apenas divisões de fevereiro

Quando: Alternar para modo pessoal
Então: Exibe despesas pessoais do mês atual (fevereiro)
```

### 7. Override de Plano
```
Dado: Usuário com subscription_plan = 'free'
E: plano_override = TRUE
Quando: Acessar /calendario
Então:
  - Toggle familiar aparece (override concede acesso)
  - Pode criar e visualizar grupos
```

## Script SQL de Teste

Execute este script para criar cenário de teste completo:

```sql
-- 1. Criar dois usuários de teste
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'joao@teste.com'),
  ('22222222-2222-2222-2222-222222222222', 'maria@teste.com')
ON CONFLICT (id) DO NOTHING;

-- 2. Criar perfis
INSERT INTO public.perfis (id, nome_completo, email, subscription_plan) VALUES
  ('11111111-1111-1111-1111-111111111111', 'João Silva', 'joao@teste.com', 'premium'),
  ('22222222-2222-2222-2222-222222222222', 'Maria Santos', 'maria@teste.com', 'premium')
ON CONFLICT (id) DO UPDATE SET
  subscription_plan = EXCLUDED.subscription_plan;

-- 3. Criar grupo familiar
INSERT INTO public.family_groups (id, nome, criado_por) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Família Teste', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- 4. Adicionar membros ao grupo
INSERT INTO public.family_members (group_id, user_id, papel) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'membro')
ON CONFLICT (group_id, user_id) DO NOTHING;

-- 5. Criar divisão de despesa (supermercado)
INSERT INTO public.family_expense_splits (id, group_id, descricao, valor_total, paid_by, categoria, criado_em) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
   'Supermercado Extra', 
   30000, -- R$ 300,00
   '22222222-2222-2222-2222-222222222222', -- Maria pagou
   'alimentacao',
   CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

-- 6. Criar participantes (divisão igualitária)
INSERT INTO public.family_split_participants (split_id, participant_id, valor_devido, pago) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 15000, FALSE), -- João deve R$ 150
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 15000, TRUE)   -- Maria já pagou
ON CONFLICT (split_id, participant_id) DO NOTHING;

-- 7. Criar mais divisões para teste de navegação entre meses
INSERT INTO public.family_expense_splits (id, group_id, descricao, valor_total, paid_by, categoria, criado_em) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
   'Conta de Luz', 
   25000, -- R$ 250,00
   '11111111-1111-1111-1111-111111111111', -- João pagou
   'moradia',
   CURRENT_DATE - INTERVAL '1 month') -- Mês passado
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.family_split_participants (split_id, participant_id, valor_devido, pago) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 12500, TRUE),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 12500, FALSE)
ON CONFLICT (split_id, participant_id) DO NOTHING;

-- Verificação
SELECT 
  'Grupos criados' as tipo,
  COUNT(*) as total
FROM public.family_groups
UNION ALL
SELECT 
  'Membros adicionados',
  COUNT(*)
FROM public.family_members
UNION ALL
SELECT 
  'Divisões criadas',
  COUNT(*)
FROM public.family_expense_splits
UNION ALL
SELECT 
  'Participantes criados',
  COUNT(*)
FROM public.family_split_participants;
```

## Resultado Esperado

Após executar o script SQL:

1. Login como `joao@teste.com`:
   - Calendário pessoal mostra despesas de João
   - Toggle "Pessoal | Família Teste" visível
   - Modo familiar mostra:
     * R$ 150,00 - Supermercado Extra (não pago) - Pago por Maria
     * R$ 125,00 - Conta de Luz (pago) - Pago por João (mês anterior)

2. Login como `maria@teste.com`:
   - Calendário pessoal mostra despesas de Maria
   - Toggle "Pessoal | Família Teste" visível
   - Modo familiar mostra:
     * R$ 150,00 - Supermercado Extra (pago) - Pago por Maria
     * R$ 125,00 - Conta de Luz (não pago) - Pago por João (mês anterior)

## Validação de Segurança (RLS)

```sql
-- Verificar que João só vê suas próprias divisões
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

SELECT * FROM public.family_expense_splits;
-- Deve retornar 2 registros (ambos do grupo que João pertence)

SELECT * FROM public.family_split_participants WHERE participant_id = '11111111-1111-1111-1111-111111111111';
-- Deve retornar 2 registros (participações de João)

-- Tentar acessar grupo de outro usuário (deve falhar)
SELECT * FROM public.family_groups WHERE criado_por != '11111111-1111-1111-1111-111111111111';
-- Deve retornar 0 registros (RLS bloqueia)
```

## Troubleshooting

### Toggle não aparece
- Verificar: `perfil.subscription_plan !== 'free'` OU `perfil.plano_override === true`
- Verificar: `grupos.length > 0`

### Divisões não carregam
- Verificar: `groupId` não é null
- Verificar: Usuário é membro ativo do grupo
- Verificar console: erros de RLS

### Valores errados no calendário
- Verificar: `valor_devido` do participante (não `valor_total` da divisão)
- Verificar: Conversão centavos → reais (`/ 100`)

### Modo familiar mostra dados pessoais
- Verificar: `modoFamilia === true`
- Verificar: `divisoes` não está vazio
- Verificar: Lógica de `despesasCalendario` no useMemo
