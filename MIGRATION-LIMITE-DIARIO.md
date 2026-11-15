# MIGRATION PENDENTE: Limite Diário Manual

**Commit:** 34486cb  
**Data:** 15/11/2026  
**Status:** ⚠️ Migration criada, aguardando aplicação no Supabase

## O que foi implementado

### 1. Código da aplicação (✅ PRONTO)
- Dashboard já lê `perfil.modo_limite` e `perfil.limite_diario`
- Cálculo do limite respeita modo manual quando configurado
- Modais de edição salvam preferências via `atualizarPreferenciasLimite`
- OnboardingSimples salva receitas e despesas como lançamentos reais

### 2. Migration SQL (📝 PENDENTE)
Arquivo: `supabase/migrations/2026-11_limite_diario.sql`

Adiciona à tabela `perfis`:
- `modo_limite` (TEXT, default 'automatico') - modo do cálculo
- `limite_diario` (NUMERIC, nullable) - teto fixo quando modo = manual

## Como aplicar a migration

### Via Supabase Dashboard (Web)
1. Acesse: https://supabase.com/dashboard/project/[SEU_PROJETO]/editor
2. Abra o SQL Editor
3. Cole o conteúdo de `supabase/migrations/2026-11_limite_diario.sql`
4. Execute a query
5. Verifique se as colunas foram criadas:
   ```sql
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns
   WHERE table_name = 'perfis' 
   AND column_name IN ('modo_limite', 'limite_diario');
   ```

### Via Supabase CLI (Local/CI)
```bash
cd posso-comprar
supabase db push
```

## Comportamento atual (sem migration)

✅ **Aplicação funciona normalmente:**
- Modo limite usa default 'automatico' no código
- Limite manual retorna null
- Nenhuma funcionalidade quebrada
- Salvamento falha silenciosamente (modal fecha, mas não persiste)

⚠️ **Limitações temporárias:**
- Não é possível salvar modo manual
- Não é possível definir limite diário fixo
- Configuração não persiste entre sessões

## Após aplicar a migration

✅ **Funcionalidades liberadas:**
- Modal "Configurar limite diário" salva corretamente
- Modo manual persiste no banco
- Valor do limite manual sincroniza entre dispositivos
- Dashboard exibe limite configurado pelo usuário

## Validação

Após aplicar a migration, testar:

1. **Modal de configuração:**
   - Abrir "Quanto posso gastar hoje?" → ícone Settings
   - Selecionar "Modo manual"
   - Definir valor (ex: R$ 100,00)
   - Salvar e recarregar página
   - Verificar se valor persiste

2. **Cálculo do limite:**
   - Com modo manual: deve exibir valor fixo configurado
   - Com modo automático: deve calcular (saldo - compromissos) / dias

3. **Banco de dados:**
   ```sql
   SELECT id, nome, modo_limite, limite_diario 
   FROM perfis 
   WHERE modo_limite = 'manual';
   ```

## Rollback (se necessário)

Executar no SQL Editor:
```sql
REVOKE UPDATE (modo_limite, limite_diario) ON TABLE public.perfis FROM authenticated;
ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_modo_limite_valido;
ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_limite_diario_positivo;
ALTER TABLE public.perfis DROP COLUMN IF EXISTS modo_limite, DROP COLUMN IF EXISTS limite_diario;
```

## Arquivos alterados

- ✅ `src/pages/OnboardingSimples.jsx` - salva receitas/despesas
- ✅ `src/pages/Dashboard.jsx` - já usa modo_limite corretamente
- ✅ `src/contexts/AuthContext.jsx` - atualizarPreferenciasLimite pronto
- 📝 `supabase/migrations/2026-11_limite_diario.sql` - aguardando aplicação

## Próximas etapas

1. Aplicar migration no Supabase (staging primeiro, depois produção)
2. Validar salvamento do limite manual
3. Testar onboarding com conta nova
4. Confirmar persistência após reload
5. Verificar sincronização entre dispositivos
