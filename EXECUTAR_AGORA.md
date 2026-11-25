# 🚀 EXECUTAR SCHEMA BASE - GUIA PASSO A PASSO

**Autorizado para:** DEV gxfcfpdwyjqcrfssxgbi  
**Arquivo:** `01_EXECUTAR_SCHEMA_BASE_CORRIGIDO.sql`  
**Status:** ✅ Auditado e aprovado

---

## ⚠️ ANTES DE COMEÇAR

### Confirmações Obrigatórias:

- [x] Ambiente DEV confirmado: gxfcfpdwyjqcrfssxgbi
- [x] Arquivo corrigido preparado
- [x] Auditoria completa realizada
- [x] 2 problemas críticos corrigidos
- [x] Produção protegida (ievccupeijzuzhomphwn)

---

## 📋 PASSO 1: ACESSAR SUPABASE SQL EDITOR

1. Abra o navegador
2. Acesse: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql
3. Faça login se necessário
4. Confirme que o projeto é **"almeida-finanças-desenvolvimento-br"**
5. Confirme que a região é **"São Paulo, Brazil"**

---

## 📋 PASSO 2: PREPARAR O SQL

1. Abra o arquivo: `01_EXECUTAR_SCHEMA_BASE_CORRIGIDO.sql`
2. Verifique o cabeçalho:
   ```sql
   -- DESTINO: gxfcfpdwyjqcrfssxgbi (DEV)
   ```
3. Selecione TODO o conteúdo (Ctrl+A)
4. Copie (Ctrl+C)

---

## 📋 PASSO 3: EXECUTAR NO SUPABASE

1. No Supabase SQL Editor, clique em **"New query"**
2. Cole o SQL copiado (Ctrl+V)
3. Revise visualmente:
   - Primeira linha: `-- MIGRAÇÃO 01/39: SCHEMA BASE CORRIGIDO`
   - Última linha: `-- FIM DO SCRIPT`
4. Clique em **"Run"** (ou pressione Ctrl+Enter)
5. Aguarde 30-60 segundos
6. Observe o painel inferior para mensagens de sucesso/erro

---

## 📋 PASSO 4: COPIAR RESULTADO DA EXECUÇÃO

### Se houver SUCESSO:
- Copie a mensagem completa (Ex: "Success. No rows returned")
- Anote o tempo de execução

### Se houver ERRO:
- Copie a mensagem de erro COMPLETA
- Anote a linha que falhou
- NÃO prossiga para validação

---

## 📋 PASSO 5: VALIDAR EXECUÇÃO

1. No mesmo SQL Editor, clique em **"New query"** novamente
2. Abra o arquivo: `VALIDAR_SCHEMA_BASE_CORRIGIDO.sql`
3. Copie TODO o conteúdo
4. Cole no SQL Editor
5. Clique em **"Run"**
6. Aguarde os resultados (20 queries)

---

## 📋 PASSO 6: COPIAR RESULTADOS DA VALIDAÇÃO

### Verificar os seguintes resultados:

**Query 1 - Contagem de Tabelas:**
```
Tabelas criadas: 10
Status: ✅ CORRETO
```

**Query 2-11 - Tabelas Individuais:**
```
✅ Tabela perfis - EXISTE
✅ Tabela categorias - EXISTE
✅ Tabela subcategorias - EXISTE
✅ Tabela receitas - EXISTE
✅ Tabela cartoes - EXISTE
✅ Tabela despesas - EXISTE
✅ Tabela despesas_tipo_excecoes - EXISTE
✅ Tabela parcelamentos - EXISTE
✅ Tabela metas - EXISTE
✅ Tabela compras_cartao - EXISTE
```

**Query 12 - Foreign Key:**
```
FK: compras_cartao.subcategoria_id → subcategorias.id
Status: ✅ EXISTE
```

**Query 13 - Índice:**
```
Índice: idx_subcategorias_categoria
Status: ✅ EXISTE
```

**Query 14 - Políticas RLS:**
```
Políticas RLS: 24
Status: ✅ CORRETO
```

**Query 15 - RLS Habilitado:**
```
✅ RLS: perfis - HABILITADO
✅ RLS: categorias - HABILITADO
✅ RLS: subcategorias - HABILITADO
(... todas as 10 tabelas)
```

**Query 16 - Categorias:**
```
Categorias padrão do sistema: 19
Status: ✅ CORRETO (19 categorias)
```

**Query 17 - Categorias por Tipo:**
```
ambos    | 3
despesa  | 12
receita  | 4
```

**Query 18 - Trigger:**
```
Trigger: ao_criar_usuario
Status: ✅ EXISTE
```

**Query 19 - Function:**
```
Function: criar_perfil_novo_usuario()
Status: ✅ EXISTE
```

**Query 20 - Resumo Final:**
```
Tabelas criadas: 10
Políticas RLS: 24
Categorias padrão: 19
Status geral: ✅ SCHEMA BASE VÁLIDO
```

---

## 📋 PASSO 7: REPORTAR RESULTADOS

Após executar os passos acima, forneça:

1. ✅ ou ❌ Execução do schema (sucesso/erro)
2. Mensagem de sucesso ou erro completa
3. Tempo de execução
4. Resultados da validação (20 queries)
5. Qualquer comportamento inesperado

---

## 🧪 TESTES ADICIONAIS (Opcional)

### Teste 1: Idempotência
1. Execute `01_EXECUTAR_SCHEMA_BASE_CORRIGIDO.sql` NOVAMENTE
2. Verifique se NÃO há erros (IF NOT EXISTS)
3. Verifique se contagens permanecem iguais

### Teste 2: Trigger de Perfil
1. Crie um usuário de teste via Auth
2. Verifique se perfil foi criado automaticamente

### Teste 3: RLS - Isolamento de Dados
(Requer dois usuários de teste - pode ser feito depois)

---

## ⚠️ EM CASO DE ERRO

### Erros Comuns:

**Erro: "relation already exists"**
- Schema já foi executado antes
- Verificar se é o mesmo schema ou conflito

**Erro: "relation does not exist"**
- Dependência não resolvida
- Verificar ordem de criação de tabelas

**Erro: "permission denied"**
- Usar service_role key (SQL Editor usa automaticamente)
- Verificar se RLS não está bloqueando

### Se houver erro:
1. ❌ NÃO prossiga com testes
2. Copie o erro completo
3. Relate o problema
4. Aguarde análise antes de nova tentativa

---

## ✅ CRITÉRIOS DE SUCESSO

Para considerar a execução bem-sucedida:

- [x] Execução sem erros
- [x] 10 tabelas criadas
- [x] 24 políticas RLS ativas
- [x] 19 categorias padrão inseridas
- [x] 1 trigger criado
- [x] 1 function criada
- [x] Todas as foreign keys válidas
- [x] RLS habilitado em todas as tabelas

---

**Pronto para executar!** 🚀

Siga os passos acima e reporte os resultados.
