# Pagamento de faturas: relatório de implementação e testes

Branch: `feat/pagamento-faturas` (PR #4, rascunho). Nada foi enviado ao remoto e a produção não foi tocada.

**Veredito: NÃO APROVADO PARA PRODUÇÃO.** Há validações obrigatórias pendentes (seção 8). O PR deve continuar como rascunho.

## Resumo do estado

| Item | Estado |
|---|---|
| Implementação (SQL, lib, hook, modal, telas, integração) | Concluída |
| Testes unitários em node (dados fictícios, em memória) | Executados e aprovados |
| Testes das migrations/RPCs em PGlite | Escritos, **NÃO executados** (pacote `@electric-sql/pglite` não instalável: npm devolve 403) |
| `npm run build` (Vite) | **NÃO executado** (sem `node_modules`) |
| Testes reais no Supabase DEV (pagamentos total, parcial, antecipado, estorno, reload, duplicidade) | **BLOQUEADO**: sem credenciais DEV e o DNS `fzawugbiojmtrthmshcc.supabase.co` não resolve (ver `DEV-BLOQUEADO.md`) |
| Playwright `e2e/pagamento-fatura.spec.js` | Escrito, **NÃO executado** |
| Aplicação da migration em DEV e produção | **NÃO realizada** |

Nenhum resultado de DEV foi simulado ou inventado neste relatório.

## 1. Função de pagamento que já existia (reaproveitada)

`useFaturasCartao.marcarFaturaPaga` apenas gravava `pago` (boolean) e `pago_em` em `faturas_cartao`. Não registrava valor, conta, histórico nem estorno, e não mexia no saldo. Era consumido em `Cartoes.jsx`, `useProjecao.js`, `horizonteFinanceiro.js` e `faturaCartao.js`.

Reaproveitado: a chave de ciclo `(cartao_id, ano_mes)`, `useFaturasCartao` (totais informados), `Modal`, `InputMoeda`, classes de estilo e tokens `marca`. O botão "Marcar fatura como paga / Desfazer" foi substituído pelo novo fluxo. A coluna `pago` segue existindo por compatibilidade: faturas antigas pagas viram pagamento legado na migration, e a lib trata `pago = true` sem nenhum registro de pagamento como paga.

## 2. Causa do bug 5.970,18 x 7.800,93 (detalhamento)

Não havia dados reais para reproduzir o caso exato; as causas abaixo foram encontradas no código e reproduzidas com dados fictícios em `tests/fatura-detalhamento.test.mjs` (falha no código antigo: 10 asserções reprovadas e `statusDetalhamento` inexistente; todas passam agora):

1. **Parcelamentos entravam no ciclo errado.** `linhasFaturaCompleta` usava o mês de `primeira_parcela` sem aplicar o fechamento, enquanto as compras aplicam. Uma 1ª parcela em 25/11 (fechamento dia 20) caía em novembro em vez de dezembro, e inflava a fatura de novembro (no teste: 5.970,18 + 1.830,75 = 7.800,93).
2. **Duplicidade compra x parcelamento.** Um parcelamento igual a uma compra já lançada (mesmo cartão, descrição, valor total e nº de parcelas) era somado duas vezes. Agora é descartado (`parcelamentosDaFatura`).
3. **Sem filtro por cartão na lib.** `linhasFaturaCompleta` aceita `cartaoId` e ignora compras e parcelamentos de outro cartão.
4. **"100% detalhada" com detalhado maior que o total.** A tela usava `totalDetalhado >= totalFatura`. Agora `statusDetalhamento` retorna `completo` somente se a soma é igual ao total ao centavo, `divergente` se maior (aviso em âmbar com o valor excedente, nunca 100%) e `parcial` (máximo 99%) se menor.
5. **Duas regras de total.** A tela usava o total informado e a projeção usava o maior entre informado e compras. Agora a tela usa `resumoFaturaCartao`, a mesma fonte da projeção.

Premissa a validar com dados reais: a 1ª parcela de um parcelamento segue a regra de fechamento como se fosse a data da compra. Se `primeira_parcela` for gravada como data de vencimento da parcela, ajustar `competenciaParcelamento`.

## 3. Modelo de pagamento

- Tabela `pagamentos_fatura` (migration `supabase/migrations/2026-11_pagamentos_fatura.sql`): valor > 0, `ano_mes` (competência = mês de fechamento), data, origem (`saldo_principal` ou `outra_conta`), status `ativo` ou `estornado`, `idempotency_key` única por usuário, `legado`.
- RLS: o usuário só lê as próprias linhas. Não existe INSERT/UPDATE/DELETE direto para `authenticated`.
- RPCs `SECURITY DEFINER` com `auth.uid()`: `pagar_fatura_cartao` e `estornar_pagamento_fatura`. A primeira trava o cartão (`FOR UPDATE`), valida o dono, devolve o pagamento original se a chave se repete (duplo clique, retry, outro dispositivo) e recusa soma de pagamentos acima do total atual do ciclo, data futura, valor <= 0 e origem diferente de `saldo_principal` (`outra_conta` existe só em pagamentos legados migrados).
- Limitação: a fatura é projetada no cliente (compras e parcelamentos), então o total do ciclo (`p_total_ciclo`) vem do app. O servidor garante consistência por ciclo, mas não recalcula a fatura.
- **Saldo da conta é derivado, não gravado.** `calcularSaldoDisponivel` subtrai pagamentos ativos com origem `saldo_principal` e data depois do marco do saldo e até hoje. Pagar e estornar são, portanto, atômicos (uma linha). Pagamento não é despesa, então a compra não é contada duas vezes.
- Conta de origem: o app não tem tabela de contas (existe um único saldo informado). Só `saldo_principal` é aceito na criação; "Outra conta" só aparece em pagamentos legados, que não debitam o saldo.
- Backfill: faturas com `pago = true` viram pagamento legado (`origem = outra_conta`, não debita saldo), idempotente pela chave `legado-<id>`.

## 4. Regras de cálculo (src/lib/faturaCartao.js)

- Pagamento pertence ao ciclo referenciado. Compras de outro ciclo nunca são abatidas.
- `saldoEmAbertoFatura = total do ciclo - pagamentos ativos` (limitado ao total).
- Carry-over: o saldo em aberto do ciclo anterior aparece como "Saldo anterior" no ciclo seguinte, apenas informativo. Não é somado ao total do ciclo nem à dívida, então não duplica. A dívida total é a soma dos saldos em aberto de cada ciclo.
- `limiteComprometido` usa saldo em aberto por ciclo: pagamento parcial libera limite proporcional, total libera tudo, estorno restaura.
- Status: Aberta, Fechada, Parcialmente paga, Paga, Vencida (`statusFatura`). Vencimento nominal (cai no mês seguinte quando `dia_vencimento < dia_fechamento`).
- Pagamento antecipado: permitido em ciclo aberto ou futuro, com data até hoje.

## 5. Integração

`useProjecao` (faturas a vencer, saldo seguro, saldo disponível), `horizonteFinanceiro.gerarHorizonte` (calendário da Home e Projeção), `Dashboard.jsx` (Próximos 7 dias), `HorizonteFinanceiro`, `Projecao.jsx` e Posso Comprar (via `useProjecao`). `Cartoes.jsx`: botão "Pagar fatura" por ciclo, selo de status, histórico e estorno com confirmação. `usePagamentosFatura` recarrega ao focar a janela, por evento entre telas e por realtime (quando habilitado no Supabase) para sincronizar dispositivos.

`Calendario.jsx` agora obtém `comprasCartao`, `faturasInformadas` e `pagamentosFatura` de `useProjecao` e os repassa a `gerarHorizonte` (vazios no modo família), então as faturas e o saldo em aberto aparecem no calendário.

## 6. Testes

### Executados de verdade (node puro, dados fictícios, sem rede). Ver também seção 8.2

Comando: `node tests/<arquivo>.test.mjs`.

| Arquivo | Resultado |
|---|---|
| `tests/fatura-cartao.test.mjs` (adaptado para importar a lib direto, sem Vite) | Aprovado |
| `tests/fatura-detalhamento.test.mjs` (caso 5.970,18 / 7.800,93) | Aprovado (falha no código antigo) |
| `tests/pagamento-fatura.test.mjs` (total, parcial, antecipado, estorno, carry-over, status, limite, saldo, duplicidade) | Aprovado |
| `tests/saldo-disponivel.test.mjs` (inclui pagamentos: marco, futuro, legado, estornado, dedup) | Aprovado |
| `tests/valor-fatura-consumidores.test.mjs` (saldo em aberto e limite comprometido, usados por Home, Calendário e Projeção) | Aprovado |

Estes testes são **simulados em memória**: validam as regras puras, não o banco.

### Não executados (ambiente sem npm)

- `npm run test:migrations` (PGlite): `supabase/tests/simular-migrations.mjs` ganhou a seção "pagamentos_fatura" (atomicidade, idempotência, concorrência com mesma chave, estorno, excesso, data futura, RLS entre dois usuários, INSERT/UPDATE direto bloqueados, backfill idempotente). Não rodou.
- `npm run build`.
- Os testes `icones`, `select-customizado` e outros que dependem do Vite não rodam sem `node_modules`; a falha já existia antes das mudanças.

### Bloqueado: testes reais no DEV

Escrito em `e2e/pagamento-fatura.spec.js` (parcial, reload, duplicidade, excesso, total, estorno, antecipado, isolamento entre usuários). Para executar, depois de aplicar a migration no DEV:

```
npm ci
# aplicar supabase/migrations/2026-11_pagamentos_fatura.sql no SQL Editor do DEV
# criar .env.development.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY do DEV
npm run test:unit
npm run test:migrations
npm run build
npm run dev -- --mode development   # em outro terminal
E2E_EMAIL=... E2E_SENHA=... E2E_EMAIL_B=... E2E_SENHA_B=... \
  npx playwright test e2e/pagamento-fatura.spec.js --config=playwright.dev.config.js
```

Também é necessário validar visualmente (tema claro e escuro, mobile e desktop) os novos blocos de `Cartoes.jsx`; isso não foi feito.

## 6.1 Tratamento da revisão (2026-11-24-224939-review.md)

| # | Problema | Decisão |
|---|---|---|
| 1 | Total do ciclo confiado ao cliente | **Revisto na terceira etapa (decisão 2, seção 8.1).** A âncora do total foi REMOVIDA da RPC: ela obrigava a estornar pagamentos para pagar após nova compra. Hoje o teto é o total atual informado pelo app e `total_ciclo_ref` é só snapshot. O total ainda vem do cliente (a fatura é projetada no app); recalcular no servidor fica como evolução. |
| 2 | SQL e RPCs nunca executados | **Não corrigível aqui.** Sem npm (403) e sem credenciais DEV. Segue bloqueado, com os comandos da seção 6. Foi adicionado um caso PGlite para a âncora (também não executado). |
| 3 | Carry-over só informativo | **Mantido por decisão de projeto.** Somar o saldo anterior ao ciclo seguinte duplicaria o valor, pois cada ciclo é pago e cobrado separadamente, e juros do rotativo exigem regras que o enunciado não define. O ciclo antigo continua Vencida e o modal avisa o valor. Precisa de confirmação do dono do produto. |
| 4 | Realtime sem publicação | **Corrigido.** A migration adiciona `pagamentos_fatura` a `supabase_realtime` de forma idempotente (só se a publicação existir e a tabela ainda não estiver nela). |
| 5 | Data anterior ao marco não debita | **Corrigido por aviso.** O modal informa que, com origem no saldo principal, o saldo só é debitado se a data for posterior ao último saldo informado. A data não foi restringida, pois o marco não está disponível na tela de cartões e o registro retroativo continua válido para o histórico. |
| 6 | Backfill ignora fatura paga com valor 0 ou sem total | **Mantido.** `valor` tem `CHECK (valor > 0)`, então não há pagamento de R$ 0,00 a registrar. A lib já trata essas faturas como pagas pelo boolean. Conferir no DEV com: `SELECT count(*) FROM faturas_cartao WHERE pago AND COALESCE(valor_total,0) = 0;`. |
| 7 | Validação visual e Calendario.jsx | **Calendário corrigido na revisão v2:** `Calendario.jsx` passava só `cartoes` e `gerarHorizonte` descartava as faturas (total 0); agora recebe compras, faturas informadas e pagamentos. Verificação visual de temas e responsividade segue **não executável aqui** (sem navegador e sem build). |

## 7. Ordem de aplicação

1. DEV: aplicar `2026-11_pagamentos_fatura.sql` (depende de `faturas_cartao` com `pago`/`pago_em`, migrations de 2026-10). Reaplicar para confirmar idempotência.
2. Rodar a suíte acima no DEV e revisar os resultados.
3. Somente após aprovação: aplicar a mesma migration em produção e publicar o front-end. O front-end novo sem a migration mostra "migração ainda não aplicada" e segue funcionando sem pagamentos.

## 6.2 Tratamento da revisão v2 (2026-11-24-225122-review.md)

| # | Problema | Tratamento |
|---|----------|------------|
| 1 | Teste da âncora quebrava o teste do antecipado | **Superado.** A âncora foi removida (seção 8.1). Suíte PGlite ainda não executada (sem npm). |
| 2 | Calendário sem dados de fatura | **Corrigido.** `Calendario.jsx` passa `comprasCartao`, `faturasInformadas` e `pagamentosFatura` a `gerarHorizonte`. |
| 3 | Âncora sem orientação ao usuário | **Superado.** Sem âncora, não há mais erro de total divergente nem necessidade de estorno. |
| 4 | DEV, build, e2e e visual pendentes | **Não corrigível aqui** (sem npm, sem credenciais DEV, sem navegador). Executar antes de produção, conforme a seção 6. |

## 8. Terceira etapa: decisões, auditoria e estado das validações

### 8.1 Decisões adotadas

1. **Origem do pagamento só `saldo_principal`.** Não há tabela de contas. A RPC recusa `outra_conta`. Pagamentos legados migrados usam `outra_conta` e nunca debitam o saldo.
2. **Âncora de total removida da RPC.** O teto é o total atual do ciclo informado pelo app; pagamentos ativos são preservados e nova compra após pagamento parcial é permitida sem estorno (em aberto = total - pago). `total_ciclo_ref` é snapshot. Se o total cair abaixo do pago, o em aberto é 0 e o app expõe `excedentePago`; nada é debitado a mais.
3. **`excedentePago` exposto** em `cicloFatura` quando o total atual fica menor que o já pago.
4. **Primeira parcela segue a regra de fechamento** como se fosse a data da compra (`competenciaParcelamento`). Premissa a confirmar com dados reais: se `primeira_parcela` for gravada como data de vencimento da parcela, ajustar essa função.

### 8.2 Executado (nesta etapa, ambiente local sem `node_modules`)

| Comando | Resultado |
|---|---|
| `node tests/fatura-cartao.test.mjs` | Aprovado |
| `node tests/fatura-detalhamento.test.mjs` | Aprovado |
| `node tests/pagamento-fatura.test.mjs` | Aprovado |
| `node tests/saldo-disponivel.test.mjs` (novos casos de pagamento) | Aprovado |
| `node tests/valor-fatura-consumidores.test.mjs` (novo) | Aprovado |
| `node --check` em `src/lib/saldoDisponivel.js` e `src/lib/faturaCartao.js` | Sintaxe ok |
| `npm ci` | **Falhou: 403 Forbidden** do registry (política de segurança). Não contornado. |
| DNS de `fzawugbiojmtrthmshcc.supabase.co` (DEV documentado) | **Não resolve** |
| `.env*` | Inexistente (sem credenciais DEV) |

O host `ievccupeijzuzhomphwn.supabase.co` resolve e pode ser produção: **não foi acessado**.

#### Quatro falhas antigas (não corrigidas nem alteradas, registradas como estão)

| Teste | Resultado |
|---|---|
| `tests/icones.test.mjs` | Falha: `Cannot find package 'sharp'` (dependência não instalável sem npm) |
| `tests/investimentos-page.test.mjs` | Falha: 2 testes (ex.: "Hook chamado antes do return") |
| `tests/investimentos-robustez.test.mjs` | Falha: 2 testes |
| `tests/onboarding-componente.test.mjs` | Falha: verificações de `useOnboarding` / `AreaAutenticada` (`CHAVE_CONFIGURANDO`, `verificando`, `precisaOnboarding`) |

Segundo o contexto da tarefa, as quatro já falham em `main`. Nenhum desses arquivos foi editado.

### 8.3 Auditoria de regressões (leitura de código + testes puros)

- **Saldo disponível** (`saldoDisponivel.js`): pagamentos com data <= marco, futuros, estornados, `outra_conta`/legado e ids repetidos não debitam. Coberto em `tests/saldo-disponivel.test.mjs`. Sem regressão encontrada.
- **Limite**: `limiteComprometido` usa saldo em aberto por ciclo; parcial reduz uma vez, total libera, estorno restaura, nova compra soma só o novo, parcelamento não é contado em dobro com a compra (testes em `tests/valor-fatura-consumidores.test.mjs` e `tests/pagamento-fatura.test.mjs`).
- **Home/Dashboard** (`Dashboard.jsx` ~2258, ~2388, ~2696), **Projeção** (`Projecao.jsx`), **`useProjecao.js`** (faturas a vencer e saldo) e **`horizonteFinanceiro.js`**: todos usam `saldoEmAbertoFatura(totalFaturaComOverride(...), pagamentos, ...)` e o saldo derivado com pagamentos. Não foi achado cálculo paralelo que ignore ou conte duas vezes os pagamentos.
- **Calendário**: a afirmação anterior desta seção estava incompleta. `Calendario.jsx` passava `comprasCartao`, `faturasInformadas` e `pagamentosFatura`, mas não `parcelamentos`, então parcelas ligadas a cartão ficavam fora do total do ciclo e o calendário divergia de Cartões e Dashboard (achado da revisão v3, corrigido: agora passa `parcelamentos`, vazio no modo família). Parcelamentos sem cartão já eram tratados por `gerarHorizonte`, sem duplicar. Continua leitura de código, não executado.
- **Posso Comprar**: `PossoCComprar.jsx` consome `useProjecao` (saldo e compromissos já com pagamentos); não há cálculo de fatura próprio.
- **Limite da cobertura**: `gerarHorizonte` **não é importável em node puro** (importa `useDespesas` e `useParcelamentos`, que carregam react e supabase). O teste novo reproduz a composição `saldoEmAbertoFatura(totalFaturaComOverride(...))` com as funções puras. O comportamento de `gerarHorizonte` em si, dos componentes e do Posso Comprar **não foi executado**; é leitura de código.

### 8.4 Revisão da migration e RPCs (leitura, sem execução)

A migration **não foi executada** e **não está validada**. Achados da leitura:

- RLS ativa; policy só de SELECT por `auth.uid() = usuario_id`; `REVOKE ALL` de `anon` e `authenticated` com `GRANT SELECT`. Sem escrita direta.
- RPCs `SECURITY DEFINER` com `search_path = public`, `auth.uid()` obrigatório, `EXECUTE` revogado de `PUBLIC` e `anon`. O cartão é validado pelo dono (`usuario_id = auth.uid()`) com `FOR UPDATE`, o que serializa dois pagamentos no mesmo cartão.
- Idempotência: `UNIQUE (usuario_id, idempotency_key)`; repetição com mesmos parâmetros devolve o original, com parâmetros diferentes é recusada. Estorno trava a linha (`FOR UPDATE`) e recusa o segundo estorno. Em READ COMMITTED o segundo estorno concorrente revê o status depois do lock, então não reverte em dobro.
- Backfill idempotente pela chave `legado-<id>`, `outra_conta`, sem débito. Um legado estornado pelo usuário não é recriado (`ON CONFLICT DO NOTHING`).
- Publicação realtime condicional e idempotente.
- Observações (SQL não pode ser testado aqui): (a) `search_path` agora é `public, pg_temp` nas duas RPCs (aplicado após a revisão v3, sem execução); (b) o total do ciclo vem do cliente, então um usuário pode registrar pagamento acima do total real do próprio ciclo, com impacto restrito aos próprios dados; (c) `estornar_pagamento_fatura` trava só a linha do pagamento, não o cartão, o que é suficiente porque o pagar soma pagamentos ativos já confirmados.

### 8.5 Pendente (não executado, não declarado aprovado)

- Aplicar a migration no DEV (e reaplicar para confirmar idempotência). **Bloqueado**: sem credenciais e DNS do DEV não resolve.
- `npm run test:migrations` (PGlite): inclui atomicidade, idempotência, estorno repetido, RLS entre dois usuários, INSERT/UPDATE direto bloqueados e backfill. **Bloqueado**: npm 403.
- Teste real de concorrência entre dois pagamentos no mesmo cartão (duas sessões) no DEV.
- Teste real de RLS entre dois usuários no DEV.
- `npm run build` (Vite). **Bloqueado**: sem `node_modules`.
- `npm run test:unit` completo e Playwright `e2e/pagamento-fatura.spec.js`. **Bloqueado**.
- Validação visual (tema claro e escuro, mobile e desktop) de Cartoes, Home, Calendário, Projeção e Posso Comprar.
- Confirmar com dados reais a premissa da primeira parcela (decisão 4) e a query de faturas pagas com valor 0 (seção 6.1, item 6).
- Resolver as quatro falhas antigas ou confirmá-las em `main`.

### 8.6 Terceira revisão independente (v3)

Revisor separado de quem implementou. **Veredito: NEEDS_CHANGES.** O revisor executou os cinco testes node puros (passaram); migration, PGlite, build e e2e não foram executados. Tratamento de cada item (as correções abaixo também **não foram executadas**, só `node --check` e os testes node puros):

| # | Item (classificação) | Tratamento |
|---|---|---|
| 1 | Calendário sem `parcelamentos` (confirmado) | **Corrigido.** `Calendario.jsx` passa `parcelamentos` a `gerarHorizonte`. Seção 8.3 corrigida. |
| 2 | Consultor não lê `pagamentos_fatura` (confirmado) | **Corrigido na migration** (policy SELECT com `consultor_autorizado`, criada só se a função existir). Não coberto no PGlite (a simulação não carrega a migration de consultoria) e não executado. |
| 3 | Sem teto confiável do total no servidor (provável) | **Risco aceito, a ser confirmado pelo responsável.** Um teto no servidor exigiria replicar em SQL a regra de ciclo, fechamento e parcelas do cliente, com risco de divergir e de bloquear pagamentos legítimos ou novas compras (o problema da âncora). Mitigação barata no cliente: alerta visível em Cartões quando `excedentePago > 0`, com orientação de conferir e estornar. Não implementado: rebuscar compras antes do envio. O servidor também não valida saldo suficiente nem existência de compras no ciclo. Recomendação: calcular o total em SQL (função de fatura por ciclo) numa etapa própria, com testes de paridade com `faturaCartao.js`. Impacto restrito aos dados do próprio usuário. |
| 4 | Concorrência não comprovada (possível) | **Não corrigível aqui.** Segue pendente em 8.5: duas sessões reais no DEV (mesma chave, chaves diferentes no mesmo cartão, pagar contra estornar). O teste PGlite só valida a lógica de idempotência. |
| 5 | Retry após estorno devolve pagamento estornado como sucesso (possível) | **Corrigido.** A RPC recusa com "Este pagamento já foi estornado" quando a chave corresponde a um pagamento estornado; novo caso no PGlite (não executado). |
| 6 | Texto de estorno de legado (confirmado) | **Corrigido.** `handleEstornar` informa que pagamento legado não debitou e o saldo não muda. |
| 7 | `search_path` sem `pg_temp` (possível, baixo) | **Corrigido** nas duas RPCs (`public, pg_temp`). |
| 8 | Validações pendentes e relatório incompleto (confirmado) | **Mantido pendente** (8.5). Esta seção foi preenchida. |

**Situação: NAO APROVADO PARA PRODUCAO.** Persistem migration, PGlite, build, e2e, RLS e concorrência reais e validação visual sem execução.
