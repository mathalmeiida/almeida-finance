# ✅ CHECKLIST: Execução do Schema Base Corrigido

## 📋 Pré-Execução

- [x] Arquivo `01_EXECUTAR_SCHEMA_BASE.sql` corrigido
- [x] Tabela `subcategorias` adicionada
- [x] Dependências verificadas (subcategorias antes de compras_cartao)
- [x] Políticas RLS completas (21 policies)
- [x] Categorias padrão confirmadas (19 categorias)
- [x] Sintaxe validada localmente (node validar-sql-sintaxe.js)
- [x] Ambiente DEV isolado (gxfcfpdwyjqcrfssxgbi)
- [x] Produção protegida (ievccupeijzuzhomphwn intocado)

---

## 🚀 Execução Manual (VOCÊ FAZ)

### Passo 1: Acessar Supabase DEV

```
https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql
```

**Checklist:**
- [ ] Logado no Supabase
- [ ] Projeto correto: **gxfcfpdwyjqcrfssxgbi** (DEV)
- [ ] Região: São Paulo
- [ ] Status: Healthy

---

### Passo 2: Executar Schema Base

1. **[ ]** Clique em **"SQL Editor"** no menu lateral
2. **[ ]** Clique em **"New query"**
3. **[ ]** Abra o arquivo `01_EXECUTAR_SCHEMA_BASE.sql` no seu editor
4. **[ ]** **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)
5. **[ ]** **Cole** no SQL Editor do Supabase (Ctrl+V)
6. **[ ]** Verifique o cabeçalho:
   ```sql
   -- DESTINO: gxfcfpdwyjqcrfssxgbi (DEV)
   ```
7. **[ ]** Clique em **"Run"** (ou `Ctrl+Enter`)
8. **[ ]** Aguarde 30-60 segundos
9. **[ ]** Verifique mensagem de sucesso no painel inferior

**⚠️ SE DER ERRO:**
- Leia a mensagem de erro
- Copie o erro completo
- NÃO continue para o próximo passo
- Reporte o erro antes de prosseguir

---

### Passo 3: Validar Execução

1. **[ ]** No mesmo SQL Editor, clique em **"New query"** novamente
2. **[ ]** Abra `VALIDAR_SCHEMA_BASE_CORRIGIDO.sql`
3. **[ ]** Copie TODO o conteúdo
4. **[ ]** Cole no SQL Editor
5. **[ ]** Clique em **"Run"**
6. **[ ]** Revise os resultados abaixo

---

## 📊 Resultados Esperados da Validação

### Query 1: Contagem de Tabelas
```
Tabelas criadas: 10
Status: ✅ CORRETO
```

### Queries 2-11: Verificação Individual
```
✅ Tabela perfis                - EXISTE
✅ Tabela categorias            - EXISTE
✅ Tabela subcategorias         - EXISTE  ⬅ CORRIGIDO
✅ Tabela receitas              - EXISTE
✅ Tabela despesas              - EXISTE
✅ Tabela despesas_tipo_excecoes - EXISTE
✅ Tabela parcelamentos         - EXISTE
✅ Tabela metas                 - EXISTE
✅ Tabela cartoes               - EXISTE
✅ Tabela compras_cartao        - EXISTE
```

### Query 12: Foreign Key
```
FK: compras_cartao.subcategoria_id → subcategorias.id
Status: ✅ EXISTE
```

### Query 13: Índice
```
Índice: idx_subcategorias_categoria
Status: ✅ EXISTE
```

### Query 14: Políticas RLS
```
Políticas RLS: 21
Status: ✅ CORRETO
```

### Query 15: RLS Habilitado
```
✅ RLS: perfis               - HABILITADO
✅ RLS: categorias           - HABILITADO
✅ RLS: subcategorias        - HABILITADO  ⬅ NOVO
✅ RLS: receitas             - HABILITADO
✅ RLS: despesas             - HABILITADO
✅ RLS: despesas_tipo_excecoes - HABILITADO
✅ RLS: parcelamentos        - HABILITADO
✅ RLS: metas                - HABILITADO
✅ RLS: cartoes              - HABILITADO
✅ RLS: compras_cartao       - HABILITADO
```

### Query 16: Categorias
```
Categorias padrão do sistema: 19
Status: ✅ CORRETO (19 categorias)
```

### Query 17: Categorias por Tipo
```
ambos    | 3
despesa  | 12
receita  | 4
```

### Query 18: Trigger
```
Trigger: ao_criar_usuario
Status: ✅ EXISTE
```

### Query 19: Function
```
Function: criar_perfil_novo_usuario()
Status: ✅ EXISTE
```

### Query 20: Resumo Final
```
Tabelas criadas:    10
Políticas RLS:      21
Categorias padrão:  19
Status geral:       ✅ SCHEMA BASE VÁLIDO
```

---

## ✅ Pós-Validação

**Se TODOS os checks acima passaram:**

- [ ] Schema base instalado com sucesso
- [ ] Tabela `subcategorias` criada e funcional
- [ ] Foreign key `compras_cartao → subcategorias` válida
- [ ] RLS ativo em todas as 10 tabelas
- [ ] 19 categorias padrão inseridas
- [ ] Pronto para executar as 38 migrations restantes

---

## 🚨 SE ALGO FALHAR

1. **NÃO prossiga** para as migrations subsequentes
2. **Copie** toda a saída do SQL Editor (incluindo erros)
3. **Relate** o problema específico:
   - Qual query falhou?
   - Qual tabela/policy não foi criada?
   - Qual foi a mensagem de erro?
4. **Aguarde** correção antes de continuar

---

## 📂 Arquivos Necessários

| Arquivo | Localização | Uso |
|---------|-------------|-----|
| `01_EXECUTAR_SCHEMA_BASE.sql` | Raiz do projeto | Executar no SQL Editor |
| `VALIDAR_SCHEMA_BASE_CORRIGIDO.sql` | Raiz do projeto | Validar após execução |
| `.env.development.local` | Raiz do projeto | Conexão do app ao DEV |

---

## 🔄 Próximas Migrations (após validação)

Após confirmar que o schema base está 100% válido, executar na ordem:

1. `supabase/migrations/2026-10_admin_core.sql`
2. `supabase/migrations/2026-10_amortizacoes.sql`
3. `supabase/migrations/2026-10_beneficios.sql`
4. ... (continuar cronologicamente)

**⚠️ IMPORTANTE:** Validar CADA migration individualmente antes de prosseguir para a próxima.

---

## 🎯 Objetivo Final

- ✅ Banco DEV completo e funcional
- ✅ Estrutura idêntica ao schema evolutivo
- ✅ Todas as 10 tabelas base operacionais
- ✅ Dependências corrigidas
- ✅ RLS ativo e seguro
- ✅ Pronto para testes E2E com Playwright

---

**Data:** 2024  
**Ambiente:** DEV gxfcfpdwyjqcrfssxgbi  
**Produção:** ievccupeijzuzhomphwn (protegida)
