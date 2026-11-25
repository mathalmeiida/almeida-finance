# Aplicar Migration no DEV - Passo a Passo

## 🔗 URL do Supabase DEV
https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql

## 📋 Passos

1. **Abrir SQL Editor**
   - Clicar no link acima
   - Fazer login no Supabase
   - Garantir que está no projeto DEV (gxfcfpdwyjqcrfssxgbi)

2. **Nova Query**
   - Clicar em "New Query"

3. **Copiar SQL**
   - Abrir arquivo: `supabase/migrations/2026-01_sistema_pagamento_faturas.sql`
   - Copiar TODO o conteúdo (Ctrl+A, Ctrl+C)

4. **Colar e Executar**
   - Colar no SQL Editor (Ctrl+V)
   - Clicar em "Run" (ou Ctrl+Enter)

5. **Verificar Sucesso**
   - Deve aparecer "Success" em verde
   - Verificar se não há erros vermelhos

6. **Confirmar Tabela Criada**
   Executar esta query para confirmar:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_name = 'pagamentos_fatura';
   ```
   - Deve retornar 1 linha: pagamentos_fatura

## ✅ Pronto!
Após aplicar a migration, o sistema de pagamentos estará pronto para uso.
