# Pagamento de faturas: relatório de implementação e testes

Branch: `feat/pagamento-faturas` (PR #4, rascunho). Nada foi enviado ao remoto e a produção não foi tocada.

**Veredito: NÃO APROVADO PARA PRODUÇÃO.** O risco do total vindo do cliente foi eliminado no código (seção 9), mas a migration e a paridade SQL x JS ainda não foram executadas (seção 9.3, "Depende do DEV"). O PR deve continuar como rascunho.

## Resumo do estado

| Item | Estado |
|---|---|
| Implementação (SQL, lib, hook, modal, telas, integração) | Concluída |
| Testes unitários em node (dados fictícios, em memória) | Executados e aprovados |
| Testes das migrations/RPCs e paridade SQL x JS em PGlite | Escritos, **PENDENTE, NÃO executados** (pacote `@electric-sql/pglite` não instalável: npm devolve 403) |
| `npm run build` (Vite) | **NÃO executado** (sem `node_modules`) |
| Testes reais no Supabase DEV (pagamentos total, parcial, antecipado, estorno, reload, duplicidade) | **BLOQUEADO**: sem credenciais DEV e o DNS `fzawugbiojmtrthmshcc.supabase.co` não resolve (ver `DEV-BLOQUEADO.md`) |
| Playwright `e2e/pagamento-fatura.spec.js` | Escrito, **NÃO executado** |
| Aplicação da migration em DEV e produção | **NÃO realizada** |
| Serialização por cartão de toda escrita que altera o total (etapa 5, seção 10) | Implementada, **NÃO aprovada**: `concorrencia-fatura.mjs` em PostgreSQL real **PENDENTE** |
| Migration `20261124000002_integridade_historica_fatura.sql` (integridade histórica, seção 11) | Escrita e revisada só por leitura, **NÃO executada** (sem PostgreSQL nem PGlite). Cenários em `simular-migrations.mjs` e `concorrencia-fatura.mjs` **PENDENTES**; nenhum passou |

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

- Tabela `pagamentos_fatura` (migration `supabase/migrations/20261124000001_pagamentos_fatura.sql`): valor > 0, `ano_mes` (competência = mês de fechamento), data, origem (`saldo_principal` ou `outra_conta`), status `ativo` ou `estornado`, `idempotency_key` única por usuário, `legado`.
- RLS: o usuário só lê as próprias linhas. Não existe INSERT/UPDATE/DELETE direto para `authenticated`.
- RPCs `SECURITY DEFINER` com `auth.uid()`: `pagar_fatura_cartao` e `estornar_pagamento_fatura`. A primeira trava o cartão (`FOR UPDATE`), valida o dono, devolve o pagamento original se a chave se repete (duplo clique, retry, outro dispositivo) e recusa pagamento acima do saldo em aberto calculado no servidor (seção 9), data futura, valor <= 0 e origem diferente de `saldo_principal` (`outra_conta` existe só em pagamentos legados migrados).
- Total do ciclo: calculado no servidor por `total_fatura_ciclo_servidor` (seção 9). O `p_total_ciclo` do cliente não é mais o teto.
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
# aplicar supabase/migrations/20261124000001_pagamentos_fatura.sql no SQL Editor do DEV
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
| 1 | Total do ciclo confiado ao cliente | **Resolvido na quarta etapa (seção 9).** O servidor calcula o total do ciclo; o valor enviado pelo cliente é só uma dica e, se divergir, o pagamento é recusado. A âncora de total continua removida, então nova compra após pagamento parcial segue permitida sem estorno. |
| 2 | SQL e RPCs nunca executados | **Não corrigível aqui.** Sem npm (403) e sem credenciais DEV. Segue bloqueado, com os comandos da seção 6. Foi adicionado um caso PGlite para a âncora (também não executado). |
| 3 | Carry-over só informativo | **Mantido por decisão de projeto.** Somar o saldo anterior ao ciclo seguinte duplicaria o valor, pois cada ciclo é pago e cobrado separadamente, e juros do rotativo exigem regras que o enunciado não define. O ciclo antigo continua Vencida e o modal avisa o valor. Precisa de confirmação do dono do produto. |
| 4 | Realtime sem publicação | **Corrigido.** A migration adiciona `pagamentos_fatura` a `supabase_realtime` de forma idempotente (só se a publicação existir e a tabela ainda não estiver nela). |
| 5 | Data anterior ao marco não debita | **Corrigido por aviso.** O modal informa que, com origem no saldo principal, o saldo só é debitado se a data for posterior ao último saldo informado. A data não foi restringida, pois o marco não está disponível na tela de cartões e o registro retroativo continua válido para o histórico. |
| 6 | Backfill ignora fatura paga com valor 0 ou sem total | **Mantido.** `valor` tem `CHECK (valor > 0)`, então não há pagamento de R$ 0,00 a registrar. A lib já trata essas faturas como pagas pelo boolean. Conferir no DEV com: `SELECT count(*) FROM faturas_cartao WHERE pago AND COALESCE(valor_total,0) = 0;`. |
| 7 | Validação visual e Calendario.jsx | **Calendário corrigido na revisão v2:** `Calendario.jsx` passava só `cartoes` e `gerarHorizonte` descartava as faturas (total 0); agora recebe compras, faturas informadas e pagamentos. Verificação visual de temas e responsividade segue **não executável aqui** (sem navegador e sem build). |

## 7. Ordem de aplicação

1. DEV: aplicar `20261124000001_pagamentos_fatura.sql` (depende de `faturas_cartao` com `pago`/`pago_em`, migrations de 2026-10). Reaplicar para confirmar idempotência.
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
2. **Âncora de total removida da RPC.** O teto é o total atual do ciclo (a partir da quarta etapa, calculado no servidor); pagamentos ativos são preservados e nova compra após pagamento parcial é permitida sem estorno (em aberto = total - pago). `total_ciclo_ref` é snapshot. Se o total cair abaixo do pago, o em aberto é 0 e o app expõe `excedentePago`; nada é debitado a mais. (Desde a seção 11, fatura quitada só muda pelo fluxo controlado.)
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
- Observações (SQL não pode ser testado aqui): (a) `search_path` agora é `public, pg_temp` nas duas RPCs (aplicado após a revisão v3, sem execução); (b) item superado: o total agora é calculado no servidor (seção 9); (c) item superado: `estornar_pagamento_fatura` agora trava o cartão antes da linha do pagamento (seção 9.2).

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
| 2 | Consultor não lê `pagamentos_fatura` (confirmado) | **Corrigido na migration** (policy SELECT com `consultor_autorizado`). Na quarta etapa a ausência da função passou a falhar de forma explícita (seção 9.2). |
| 3 | Sem teto confiável do total no servidor (provável) | **Resolvido na quarta etapa (seção 9).** O risco aceito nesta revisão foi revogado: o total é calculado no servidor. |
| 4 | Concorrência não comprovada (possível) | **Não corrigível aqui.** Segue pendente em 8.5: duas sessões reais no DEV (mesma chave, chaves diferentes no mesmo cartão, pagar contra estornar). O teste PGlite só valida a lógica de idempotência. |
| 5 | Retry após estorno devolve pagamento estornado como sucesso (possível) | **Corrigido.** A RPC recusa com "Este pagamento já foi estornado" quando a chave corresponde a um pagamento estornado; novo caso no PGlite (não executado). |
| 6 | Texto de estorno de legado (confirmado) | **Corrigido.** `handleEstornar` informa que pagamento legado não debitou e o saldo não muda. |
| 7 | `search_path` sem `pg_temp` (possível, baixo) | **Corrigido** nas duas RPCs (`public, pg_temp`). |
| 8 | Validações pendentes e relatório incompleto (confirmado) | **Mantido pendente** (8.5). Esta seção foi preenchida. |

**Situação à época: NAO APROVADO PARA PRODUCAO.** A situação atual está na seção 9.

## 9. Quarta etapa: total da fatura calculado no servidor

Decisão formal do responsável: o total da fatura enviado pelo cliente não é confiável e o risco foi eliminado antes da aprovação para produção. A decisão de aceitar o risco registrada na seção 8.6 (item 3) está revogada.

### 9.1 O que mudou

- **Função SQL do total**: `public.total_fatura_ciclo_servidor(cartao, usuario, ano_mes)` em `supabase/migrations/20261124000001_pagamentos_fatura.sql`. Recebe o usuário como parâmetro, então `EXECUTE` é revogado de `PUBLIC`, `anon` e `authenticated`; só as RPCs `SECURITY DEFINER` a chamam, sempre com `auth.uid()`. Todas as consultas filtram por `usuario_id`.
- **Função pública**: `public.total_fatura_ciclo(cartao, ano_mes)` usa só `auth.uid()` e recusa cartão de outro usuário (erro 42501). Não expõe dados de terceiros.
- **Regras reproduzidas de `src/lib/faturaCartao.js`**: competência pelo dia de fechamento (limitado ao último dia de meses curtos); parcelas em centavos com o resto na última; parcelamentos pela data da 1ª parcela com a mesma regra de fechamento; parcelamentos quitados fora; dedupe parcelamento x compra (mesmo cartão, descrição normalizada sem acentos latinos, valor e nº de parcelas); pagamentos de um ciclo nunca abatem outro.
- **Fatura informada (override)**: entra no cálculo, como no app (total = maior entre o informado e as compras). Decisão explícita: é o total que o app exibe e cobra, e o dado pertence ao próprio usuário (RLS), não ao parâmetro da RPC. O boolean legado `pago` não entra (virou pagamento legado no backfill).
- **`pagar_fatura_cartao`**: mesma assinatura. Depois do lock do cartão, calcula o total no servidor, soma os pagamentos ativos (anteriores preservados), exige total > 0 e saldo em aberto > 0, e recusa `p_valor` acima do em aberto (erro 22003 com o valor em aberto). `p_total_ciclo` virou dica: se vier e divergir do servidor, a RPC recusa com "Fatura desatualizada" (erro 40001); `NULL` é aceito. `total_ciclo_ref` guarda o total do servidor. Um cliente com tela desatualizada ou total adulterado não consegue pagar acima do devido.
- **Pagamentos parciais e novas compras**: pagamentos ativos nunca são alterados; nova compra sobe o total e o em aberto passa a ser total - pago, sem estorno.
- **Cliente**: `src/lib/mensagemPagamentoFatura.js` (módulo puro) traduz os erros; ao receber "fatura desatualizada", `Cartoes.jsx` recarrega compras, parcelamentos e faturas informadas, fecha o modal e mostra a mensagem para o usuário conferir o novo total.

### 9.2 Concorrência, idempotência, policy e mensagem de estorno

- **Concorrência**: `pagar` e `estornar` travam primeiro o cartão (`FOR UPDATE`) e depois a linha do pagamento (mesma ordem cartão -> pagamento). `UNIQUE (usuario_id, idempotency_key)` segue como barreira final e um `unique_violation` concorrente devolve o pagamento original quando os parâmetros coincidem. A versão v4 só travava INSERT por efeito da chave estrangeira e deixava UPDATE e DELETE sem trava; isso foi substituído na etapa 5 (seção 10). O teste de concorrência do PGlite usa uma conexão e não prova o lock.
- **Como aplicar a migration**: como transação única. O SQL Editor executa tudo como requisição única. Na v4 o arquivo se chamava `2026-11_pagamentos_fatura.sql`, sem prefixo numérico, e o CLI não o reconhecia; na etapa 5 passou a `20261124000001_pagamentos_fatura.sql` (seção 10.5). Em `psql`: `psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261124000001_pagamentos_fatura.sql`; sem isso, o erro do bloco de pré-requisitos não impede os comandos seguintes. O cabeçalho da migration traz a mesma instrução.
- **Normalização do dedupe**: `normalizar_texto_fatura` passou a usar `normalize(texto, NFD)` e remover marcas `U+0300-U+036F`, como o `normalizarTexto` do JS (cobre qualquer acento e texto decomposto). Exige PostgreSQL 13+ e banco UTF8. Não foi executado.
- **Idempotência**: mesma chave e mesmos parâmetros devolve o original; parâmetros diferentes dão 23505; pagamento estornado dá 22023.
- **Policy `consultor_autorizado`**: avaliada. `public.consultor_autorizado(uuid)` é criada em `2026-10_consultoria_acessos.sql`, que vem antes por ordem de nome. A migration agora verifica a dependência (e as tabelas `cartoes`, `compras_cartao`, `parcelamentos`, `faturas_cartao`) no início, antes de qualquer alteração, e falha com `RAISE EXCEPTION` indicando qual migration aplicar. O script roda numa única transação, então nada fica meio aplicado. A criação da policy continua idempotente.
- **`parcelamentos.cartao_id`**: o app e a migration `20250124_proteger_exclusao_cartao.sql` já usam a coluna, mas `schema.sql` não a declara. A migration faz `ADD COLUMN IF NOT EXISTS` (sem efeito onde já existe). Conferir no DEV que a coluna existe com o tipo esperado.
- **Mensagem de estorno repetido**: o regex antigo não casava "Este pagamento já foi estornado". `mensagemAmigavel` agora cobre "Pagamento já estornado", "Este pagamento já foi estornado" e variantes sem acento, e também fatura desatualizada, sem saldo em aberto, ciclo sem valor e excesso.

### 9.3 Testado (executado nesta sessão)

Ambiente: Node v22.23.4, sem `node_modules`. Comandos e resultados reais:

| Comando | Resultado |
|---|---|
| `node tests/fatura-cartao.test.mjs` | Saiu com 0; 35 linhas PASS, 0 FALHA |
| `node tests/fatura-detalhamento.test.mjs` | Saiu com 0; 21 PASS, 0 FALHA |
| `node tests/pagamento-fatura.test.mjs` | Saiu com 0; 78 PASS, 0 FALHA (inclui as 15 verificações novas de mensagens: estorno repetido, "já foi estornado", sem acento, fatura desatualizada, excesso, quitada, ciclo sem valor) |
| `node tests/paridade-fatura-js.test.mjs` | Saiu com 0; 165 verificações, 0 falhas. Confere `faturaCartao.js` contra o gabarito `tests/fixtures/paridade-fatura.json` (valores calculados à mão, exceto os 2 casos de normalização Unicode (Åpé Ý e texto decomposto), cujo esperado veio da regra do JS: à vista, parcelado com resto de centavos, 9x, fechamento dia 31 e 30 em meses curtos e bissexto, virada de ano, parcelamentos, quitado, dedupe, fatura informada, cartões distintos, parcial, nova compra, estorno e repagamento, ciclos diferentes) |
| `node tests/saldo-disponivel.test.mjs` | Saiu com 0; 30 PASS, 0 FALHA |
| `node tests/valor-fatura-consumidores.test.mjs` | Saiu com 0; 15 PASS, 0 FALHA |
| `node tests/icones.test.mjs`, `investimentos-page`, `investimentos-robustez`, `onboarding-componente` | As quatro **falham** (saída 1), também com as mudanças desta etapa guardadas (`git stash -u`), ou seja, na base. Não foram alteradas nem mascaradas. |
| `npm ci --ignore-scripts` | **Falhou: 403 Forbidden** (`zlibjs-0.3.1.tgz`), reverificado uma vez. Não contornado. |
| `node --check` de `supabase/tests/simular-migrations.mjs`, `supabase/tests/paridade-fatura.mjs` e `e2e/pagamento-fatura.spec.js` | Sintaxe ok (isto não executa os testes) |
| `node supabase/tests/paridade-fatura.mjs` | Saiu com 2: imprime "PENDENTE - @electric-sql/pglite indisponivel". **Não executou nenhuma verificação SQL.** |

Não há Postgres local (`psql`, `postgres`, `pg_ctl` e `initdb` ausentes; docker e podman sem `conmon`) e `pip install pglast` também não encontrou pacote, então **nem a sintaxe da migration foi validada por um parser**. Esses testes node puros validam o gabarito e a lógica JS, não o SQL.

### 9.4 Depende do DEV (NÃO executado, PENDENTE)

Nada abaixo foi executado, e nenhum item é declarado aprovado. Pré-requisito: `npm ci` funcionando e acesso ao DEV documentado (`fzawugbiojmtrthmshcc`, sem DNS e sem credenciais neste ambiente).

| Item | Como executar |
|---|---|
| Migration no DEV e reaplicação (idempotência), incluindo a falha explícita sem `consultor_autorizado` | Aplicar `2026-10_consultoria_acessos.sql` e depois `supabase/migrations/20261124000001_pagamentos_fatura.sql` no SQL Editor do DEV; rodar a segunda de novo |
| Conferir `parcelamentos.cartao_id` no DEV | `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'parcelamentos' AND column_name = 'cartao_id';` |
| Simulação PGlite das migrations (RLS, RPCs, idempotência, backfill, policy do consultor, total inflado recusado, funções internas sem EXECUTE para clientes) | `npm ci && node supabase/tests/simular-migrations.mjs` |
| Paridade SQL x JS (gabarito, 25 rodadas aleatórias com semente fixa, sequências de pagamento, isolamento) | `npm ci && node supabase/tests/paridade-fatura.mjs` (também em `npm run test:migrations`) |
| Concorrência real com duas sessões (mesma chave; chaves diferentes no mesmo cartão; pagar contra estornar) | Duas conexões no DEV chamando `pagar_fatura_cartao` ao mesmo tempo. O PGlite usa uma conexão e só cobre a idempotência |
| RLS entre usuários reais | `E2E_EMAIL_B`/`E2E_SENHA_B` no e2e abaixo |
| E2E real (total inflado recusado, ciclo sem compras, `total_fatura_ciclo`, parcial, estorno, antecipado) | `E2E_EMAIL=... E2E_SENHA=... E2E_EMAIL_B=... E2E_SENHA_B=... npx playwright test e2e/pagamento-fatura.spec.js --config=playwright.dev.config.js` |
| Suíte unitária completa e build | `npm run test:unit` e `npm run build` |
| Validação visual (claro e escuro, mobile e desktop), incluindo o aviso de fatura desatualizada em Cartões | Manual, após `npm run dev -- --mode development` |
| Premissa da 1ª parcela (decisão 4 da seção 8.1) e `normalizar_texto_fatura` com `normalize(NFD)` (nunca executada; exige PG 13+ e UTF8): conferir `SELECT public.normalizar_texto_fatura('Åpé  Ý')` = `ape y` e comparar totais de cartões reais | Comparar `total_fatura_ciclo` com o total exibido no app para cartões reais do DEV |

### 9.5 Segurança do processo

O host `ievccupeijzuzhomphwn.supabase.co` não foi acessado e não é presumido como DEV. Nenhuma migration foi aplicada em produção, nenhuma credencial desconhecida foi usada, o bloqueio do npm não foi contornado e o PR segue como rascunho (sem push nesta etapa).

## 10. Quinta etapa: serialização de toda escrita que altera o total da fatura

**Estado: a correção está IMPLEMENTADA, mas NÃO está aprovada.** Nenhum teste de concorrência foi executado em PostgreSQL real, porque este ambiente não tem PostgreSQL. O PR permanece como rascunho.

### 10.1 Achado e mecanismo escolhido

- **Risco residual (v4)**: `pagar_fatura_cartao` travava o cartão, mas `UPDATE` e `DELETE` de `compras_cartao`, `parcelamentos` e `faturas_cartao` não travavam nada. Uma remoção ou redução de valor confirmada depois da leitura do total permitia pagar acima do total real.
- **Mecanismo único**: `public.travar_cartoes_fatura(ids, usuario)` faz `SELECT ... FOR UPDATE` em `cartoes`, uma linha por cartão, em ordem ascendente de `id` (deduplicados, `NULL` ignorado). É usado por `pagar_fatura_cartao`, `estornar_pagamento_fatura` e pelos triggers.
- **Triggers** (7): em `compras_cartao`, `parcelamentos` e `faturas_cartao` (INSERT, UPDATE e DELETE), `aa_fatura_travar_usuario` (BEFORE STATEMENT, com `auth.uid()` trava todos os cartões do usuário em ordem ascendente) e `aa_fatura_travar_cartao` (BEFORE ROW, trava `OLD.cartao_id` e `NEW.cartao_id`; com `auth.uid()` só trava cartões do próprio usuário, o que impede segurar lock de cartão alheio antes do RLS; sem `auth.uid()` cobre service role e SQL Editor). Em `cartoes`, `aa_fatura_travar_usuario` BEFORE DELETE STATEMENT trava todos os cartões do usuário em ordem antes da linha excluída e da cascata (v5.1, item 1 da revisão).
- **Ordem de locks e o que NÃO é garantido**: cartões por `id` ascendente, depois a linha do pagamento. Com `auth.uid()` (app e RPCs como `zerar_dados_financeiros`) a ordem é global e ascendente. Sem `auth.uid()` (service role, SQL Editor) só vale o trigger de linha, que trava na ordem em que as linhas são visitadas, então duas operações em massa concorrentes com ordens opostas podem receber 40P01. Também pode haver 40P01 com lock manual em `cartoes` fora do mecanismo. Em todos os casos a transação é abortada sem pagamento indevido e pode ser repetida. **Não se afirma "sem deadlock"**; afirma-se pagamento nunca acima do total sob lock e ordem consistente no caminho autenticado.
- **Recálculo**: o total e o valor já pago são recalculados dentro da transação, depois do lock e imediatamente antes do INSERT. A dica `p_total_ciclo` continua só como consistência (erro 40001 'Fatura desatualizada'). `pagar` exige isolamento READ COMMITTED e recusa os demais (erro 25006).
- **Conflito**: 40001, 40P01 (deadlock) e 55P03 (lock_timeout) abortam a transação sem pagamento. O app recarrega a fatura e a repetição usa a mesma `idempotency_key`.
- **Por que o DML direto não foi revogado**: os hooks (`useCartoes`, `useComprasCartao`, `useFaturasCartao`, `useParcelamentos`) e `zerar_dados_financeiros` continuam válidos, e o banco serializa independentemente do cliente. Uma RPC dedicada por operação não é necessária para a garantia e aumentaria o escopo. Reduzir o total abaixo do já pago não é bloqueado (necessário para zerar dados e excluir compras); editar depois do pagamento é uma operação posterior válida.

### 10.1.1 Tratamento da revisão v5 (2026-11-25-000000-review.md)

| Item | Decisão |
|---|---|
| 1. Cascata de DELETE de cartão inverte a ordem | **Corrigido**: trigger BEFORE DELETE STATEMENT em `cartoes` com a mesma função, travando todos os cartões do usuário em ordem antes da linha excluída. Cenários 13a a 13c (não executados). |
| 2. DML em massa sem `auth.uid()` em ordem física | **Não corrigido, justificado**. Triggers de statement com tabelas de transição só existem em AFTER (depois do DML). Lá a FK já tomou `KEY SHARE` em `cartoes`, e converter para `FOR UPDATE` faz duas sessões do mesmo cartão se bloquearem (upgrade de lock, deadlock). Em BEFORE o `FOR UPDATE` é o primeiro lock em `cartoes`. Um BEFORE STATEMENT sem `auth.uid()` não sabe quais cartões serão afetados. Risco residual aceito e documentado: 40P01 repetível, sem pagamento indevido. Quem usa service role em massa deve operar por cartão ou uma sessão por vez. |
| 3. Serialização por usuário, não por cartão | **Aceito e documentado**: pagar o cartão A espera DML de compras do cartão B do mesmo usuário até o commit. Transações são curtas; em troca a ordem de locks é única. Texto "por cartão" ajustado para "por usuário" onde se aplica ao trigger de statement. |
| 4. Lock em cartão de terceiro antes do RLS | **Corrigido**: o trigger de linha passa `auth.uid()` ao helper, que só trava cartões do dono. |
| 5. Prova de concorrência pendente | **Pendente**: sem PostgreSQL neste ambiente. Nada é declarado aprovado. |
| 6. Lacunas de cobertura | **Cenários adicionados** (não executados): 13a/13b/13c DELETE de cartão com cascata, 14a/14b `zerar_dados_financeiros` real, 15 `parcelamentos.cartao_id` nulo (INSERT e troca nulo <-> cartão), 16 UPDATE de `cartoes.dia_fechamento`, 17a repetição após 55P03, 17b repetição após 40P01 (provocado por lock manual fora do mecanismo). O antigo 7d é DELETE em massa de compras, não `zerar_dados_financeiros`. |
| Revisão v2, cenário 13a | **Corrigido**: D executa o DELETE e segura os locks, W é iniciado e comprovado bloqueado via `pg_stat_activity`, D commita antes de aguardar W, e o teste exige que ambas concluam sem erro (nem 40P01 nem 55P03). Continua **não executado**: a concorrência não foi testada em PostgreSQL real. |
| 7. Texto "sem deadlock" | **Corrigido** no cabeçalho da migration, no comentário do helper e nesta seção. |
| 8. Total abaixo do já pago | **Decisão explícita**: permitido. O limite "não pagar acima do total real" vale no instante do pagamento, sob lock do cartão. **SUPERADO pela seção 11:** em fatura quitada, editar ou excluir compra por DML direto passa a ser recusado (FP001) e só o fluxo controlado com motivo é aceito; o excesso vira crédito. Em fatura aberta ou parcial segue livre. O app expõe `excedentePago`. |
| 9. Dependências sem prefixo numérico | **Não alterado**: renomear `2026-10_*` e `2026-11_*` mudaria migrations possivelmente já aplicadas em DEV/produção (o registro de versões do CLI divergiria) e foge do escopo. Segue documentado: aplicar as dependências antes, `db push` não deve ser usado contra produção. |

### 10.2 Mapa dos caminhos de escrita

| Caminho | Tabelas | Resultado da verificação (leitura de código) |
|---|---|---|
| `src/hooks/useComprasCartao.js` | `compras_cartao` INSERT/UPDATE/DELETE | DML direto, coberto pelos triggers |
| `src/hooks/useParcelamentos.js` | `parcelamentos` INSERT/UPDATE/DELETE | DML direto, coberto pelos triggers |
| `src/hooks/useFaturasCartao.js` | `faturas_cartao` upsert/DELETE | DML direto, coberto pelos triggers |
| `src/hooks/useCartoes.js` | `cartoes`; leituras de compras, parcelamentos e faturas; exclusão com checagem prévia | `cartoes` não altera o total; DELETE de cartão espera o lock (`FOR UPDATE`) de um pagamento em curso |
| `src/lib/importacaoGravar.js` | `compras_cartao` (importação de fatura) | DML direto, coberto pelos triggers |
| `src/pages/Cartoes.jsx`, `Onboarding.jsx` | usam os hooks acima | Sem escrita própria nessas tabelas |
| `zerar_dados_financeiros` (5 versões em `supabase/migrations/2026-11_rpc_zerar_dados_financeiros*.sql`) | DELETE em `faturas_cartao`, `compras_cartao`, `parcelamentos`, `cartoes` | Cada DELETE dispara os triggers (statement trava todos os cartões do usuário em ordem); DELETE de `cartoes` espera o pagamento em curso |
| `supabase/functions/push-notificacoes` | só lê `cartoes` | Sem escrita |
| service role / SQL Editor | qualquer uma das três | Coberto pelo trigger de linha (sem `auth.uid()`) |

### 10.3 Executado neste ambiente

| Verificação | Resultado |
|---|---|
| `node --check` em `concorrencia-fatura.mjs`, `simular-migrations.mjs`, `paridade-fatura.mjs` | Passou |
| `node tests/pagamento-fatura.test.mjs`, `paridade-fatura-js.test.mjs`, `fatura-cartao.test.mjs` (node puro, dados fictícios) | Passaram, incluindo os novos casos de conflito 40P01/55P03 |
| `node supabase/tests/concorrencia-fatura.mjs` sem `PG_TEST_URL` | Imprime PENDENTE e sai com código 2 |
| Recusa de host remoto ou `supabase.co` pelo script | Confirmada (código 1) |
| Busca por referências ao nome antigo `2026-11_pagamentos_fatura` | Nenhuma restante |
| Reverificação do ambiente | Sem `postgres`, `initdb`, `psql`; docker sem `conmon`; `apt-get` ausente; npm, pip e curl com 403 |

Quatro testes antigos (`icones`, `investimentos-page`, `investimentos-robustez`, `onboarding-componente`) falham também em `main`. Não foram alterados nem mascarados.

### 10.4 PENDENTE (exige PostgreSQL real)

Nada abaixo foi executado, e nenhum item é declarado aprovado.

| Item | Como executar |
|---|---|
| `supabase/tests/concorrencia-fatura.mjs`: duas ou mais conexões `pg`, 17 grupos de cenários (exclusão, alteração de valor, inclusão, parcelamento, fatura informada, pagamentos concorrentes, mudança entre cartões e movimentos opostos, repetição após conflito, escrita sem `auth.uid()`, permissões, isolamento, estorno, exclusão de cartão com cascata, `zerar_dados_financeiros` real, `parcelamentos.cartao_id` nulo, `UPDATE cartoes.dia_fechamento`, repetição após 55P03 e 40P01) | `PG_TEST_URL=... node supabase/tests/concorrencia-fatura.mjs` (esperado código 0) |
| Aplicação da migration em PostgreSQL 13+ UTF8 (`normalize NFD`, triggers, helper) | Seção 10.5 |
| `npm run test:migrations` (PGlite) com os novos testes de existência dos 7 triggers e de permissão | Requer `npm ci` |
| Aplicação e reaplicação no DEV, e2e do pagamento | Requer acesso ao DEV |

Os testes do PGlite não provam concorrência (conexão única). A prova é o script `pg` com sessões separadas, que usa `pg_stat_activity` (`wait_event_type = 'Lock'`) para comprovar a espera real. Ponto a observar na primeira execução real: `total_fatura_ciclo_servidor` é `STABLE` e é chamada de dentro da `pagar_fatura_cartao` (volátil), então deve ler o snapshot posterior ao lock; os cenários 1 a 5 verificam exatamente isso.

### 10.5 Aplicar no DEV de forma reproduzível

Somente o projeto DEV (`fzawugbiojmtrthmshcc`), por quem tem acesso. Produção não recebe migration manual e nenhum host de produção foi acessado.

- **Nome**: `20261124000001_pagamentos_fatura.sql` segue `<versão numérica>_<nome>.sql` (reconhecido pelo Supabase CLI) e é maior que `20261119000002`, preservando a ordem. Migrations `2026-10_*` e `2026-11_*` não têm prefixo numérico e precisam estar aplicadas antes. Não usar `supabase db push` contra produção.
- **Pré-checagens**: `SHOW server_version_num;` (>= 130000), `SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname = current_database();` (UTF8), e `SELECT column_name FROM information_schema.columns WHERE table_name='parcelamentos' AND column_name='cartao_id';`. A migration também falha com mensagem clara se a versão ou a codificação não servirem, e confere a coluna `parcelamentos.cartao_id` após o `ALTER`.
- **Aplicar**: `psql "$DATABASE_URL_DEV" -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261124000001_pagamentos_fatura.sql` (ou colar o arquivo inteiro no SQL Editor). Reaplicar é seguro.
- **Concorrência em Postgres local descartável**: `docker run --rm -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16`, `npm i --no-save pg`, `PG_TEST_URL=postgres://postgres:x@127.0.0.1:55432/postgres node supabase/tests/concorrencia-fatura.mjs`. O script recusa hosts não locais (e `supabase.co`) sem `PG_TEST_PERMITIR_HOST_REMOTO=1`, recusa bancos com `public.cartoes` sem `PG_TEST_RESETAR=1` e nunca imprime a senha.

## 11. Integridade histórica após pagamento (sexta etapa)

Motivo: até a seção 10, depois de um pagamento a compra podia ser editada ou apagada e a fatura "paga" mudava sem rastro (decisão aceita na etapa 5). O responsável pelo produto não aceita isso. Esta seção substitui aquela decisão.

### 11.1 Regras por estado da competência (cartão, mês)

P = soma dos pagamentos ativos. T = total da fatura calculado no servidor.

| Estado | Condição | Alteração de compra, parcelamento ou fatura informada |
|---|---|---|
| Aberta | P = 0 | Livre e sem auditoria |
| Parcial | 0 < P < T | DML normal; pagamentos preservados; saldo em aberto = T - P; alteração relevante gera linha de auditoria |
| Quitada | P > 0 e P >= T | DML direto recusado com SQLSTATE `FP001`. Só a RPC `alterar_historico_fatura` (motivo de 5 a 300 caracteres), que audita |
| Total cai abaixo de P | | Nunca apaga pagamento. Registra crédito em `ajustes_fatura` (`tipo = 'credito'`, valor = variação, razão assinada) |

### 11.2 Estratégia de banco e impactos

Arquivo: `supabase/migrations/20261124000002_integridade_historica_fatura.sql` (depende da 000001; falha com mensagem clara se ela não estiver aplicada).

- `ajustes_fatura`: razão append-only (inclusão, edição, exclusão, crédito, estorno) com dados antes/depois, pago ativo, total depois, via (`direto`, `controlado`, `administrativo`) e motivo. RLS: leitura do dono e do consultor autorizado; cliente só tem SELECT; UPDATE e DELETE por papéis de cliente são recusados por trigger.
- `_fatura_liberacoes`: liberação por transação (`txid_current()` e `auth.uid()`), sem acesso para papéis de cliente. Some em rollback, é apagada ao fim da RPC e podada após 1 hora. Não é forjável por sessão alheia.
- Triggers `ab_fatura_guardar_historico` (BEFORE) e `zz_fatura_auditar_historico` (AFTER) em `compras_cartao`, `parcelamentos` e `faturas_cartao`; `ab_fatura_proteger_cartao` em `cartoes` (cartão com qualquer pagamento, inclusive estornado, ou linha na razão não pode ser excluído; ver 11.7); trigger em `pagamentos_fatura` (só aceita a transição ativo para estornado; DELETE recusado a papéis de cliente).
- `alterar_historico_fatura(p_tabela, p_id, p_acao, p_dados, p_motivo)`: único caminho para fatura quitada, com whitelist de colunas, trava dos cartões e auditoria `via = 'controlado'`.
- `estornar_pagamento_fatura(p_pagamento_id, p_motivo)`: motivo opcional, linha `estorno` na razão e reconciliação do crédito. A versão de 1 argumento chama a de 2.
- `zerar_dados_financeiros()` continua SECURITY INVOKER e transacional; ganhou a exceção por transação e usuário (`liberar_historico_zerar` e `encerrar_liberacao_zerar`). Pagamentos e razão saem por cascata de FK ao apagar `cartoes`.
- Reaplicar a 000001 depois da 000002 falha de propósito com mensagem clara (ver 11.7, item 7).
- Impactos: o banco é a barreira (independe do cliente); nenhum DML foi revogado, então os hooks seguem funcionando em fatura aberta e parcial. Cada DML em compras, parcelamentos e faturas calcula, por linha, os meses com pagamento ativo (importação em massa paga esse custo por linha, aceito). Consultor só lê `ajustes_fatura`.
- Residual: quem executar SQL arbitrário como o próprio usuário numa conexão direta poderia chamar `liberar_historico_zerar` e apagar o próprio histórico na mesma transação. O app não oferece essa conexão, e o usuário já pode apagar os próprios dados via zerar.

### 11.3 Decisões e pontos que precisam de confirmação do produto

- Crédito não é aplicado automaticamente a outra fatura e não altera o saldo derivado da conta. Estorno reduz o crédito por novo lançamento.
- `descricao` só é campo relevante quando coincide com a deduplicação de parcelamento (afeta o total); editar descrição ou categoria em fatura quitada não bloqueia.
- Compra de data antiga inserida em mês quitado é recusada (FP001). Não há RPC de inclusão controlada; no app aparece uma mensagem orientando estornar o pagamento ou usar outra data.
- `fatura_liberacao_ativa` tem GRANT a `authenticated`, `anon` e `service_role` porque os triggers INVOKER a chamam com o papel do cliente. Ela só informa se há liberação da transação atual para o próprio usuário.
- Desvios da migration em relação ao design estão comentados no cabeçalho dela (FEAT-001).

### 11.4 Implementado nesta etapa (app)

- `src/lib/historicoFatura.js`: detecção de `FP001`, validação de motivo, whitelist de campos, chamada da RPC (cliente recebido por parâmetro) e cálculo puro do crédito vigente.
- Hooks: `atualizarComMotivo` e `removerComMotivo` em `useComprasCartao`, `useParcelamentos` e `useFaturasCartao` (os métodos antigos não mudaram); novo `useAjustesFatura` (somente leitura).
- `src/pages/Cartoes.jsx`: ao receber `FP001` em editar compra, excluir compra ou remover o total informado, abre diálogo com o aviso e campo de motivo, e repete pela RPC. Na fatura em foco aparecem o crédito vigente e a lista "Alterações da fatura". Salvar o total informado também passa pelo fluxo (edita o total existente pela RPC). Os parcelamentos vinculados a cartão são editados, quitados e removidos em `src/pages/Despesas.jsx`, que agora tem o mesmo diálogo de motivo (ver 11.7, item 5).
- `tests/historico-fatura.test.mjs` (incluído em `npm run test:unit`).
- `supabase/migrations/README.md` com ordem e validação.
- Frases antigas que diziam que editar ou excluir após o pagamento era permitido foram corrigidas na tabela da seção 10.1 (item 8), na seção 8 (item 2) e nos comentários da migration 000001.

### 11.5 Evidências reais desta rodada (comandos reexecutados)

Ambiente (saídas reais; data da execução 2026-11-24):

| Comando | Resultado |
|---|---|
| `which psql` / `which postgres` / `which initdb` | `no psql in (...)`, `no postgres in (...)`, `no initdb in (...)`; saída 1 em todos |
| `ls node_modules` | `ls: cannot access 'node_modules': No such file or directory` |
| `npm ping` | `npm error 403 In most cases, you or one of your dependencies are requesting a package version that is forbidden by your security policy...` |
| `curl https://registry.npmjs.org/pg` | `curl: (7) CONNECT tunnel failed, response 403` |
| `getent hosts fzawugbiojmtrthmshcc.supabase.co` | sem resposta, saída 2 |
| `docker info` | `Error: could not find a working conmon binary (...)`, saída 125 |
| `PG_TEST_URL` | não definida |
| `npm run test:concorrencia` | `PENDENTE: nao executado (defina PG_TEST_URL ...). Nenhuma prova de concorrencia foi produzida.`; saída 2 |

Testes que rodaram e passaram (node puro, sem pacotes, dados fictícios): `node tests/historico-fatura.test.mjs` (todos PASS, saída 0), `node tests/pagamento-fatura.test.mjs` (saída 0) e `node tests/fatura-cartao.test.mjs` (saída 0). `node --check` em `src/lib/historicoFatura.js` e `tests/historico-fatura.test.mjs`: ok. Checagem apenas sintática (tsc com `--noResolve`, erros TS1xxx) em `Cartoes.jsx` e nos hooks alterados: sem erros de sintaxe. Isso NÃO compila nem executa a tela.

### 11.6 PENDENTE (nada abaixo foi executado, nada é declarado aprovado)

- `npm run test:migrations` (simular-migrations, incluindo os cenários de integridade histórica; paridade SQL x JS; compras-cartao-producao): sem `@electric-sql/pglite` e sem Postgres.
- `npm run test:concorrencia` (cenários 13b ajustado e 18a a 18f): sem `PG_TEST_URL`.
- RLS com dois usuários reais (A e B) em `ajustes_fatura`, `pagamentos_fatura` e nas tabelas guardadas.
- A migration 000002 nunca rodou em PostgreSQL nem PGlite. Riscos a conferir na primeira execução: `e.code` (FP001) exposto pelo driver, tabela `subcategorias` não versionada, tabelas de `zerar_dados_financeiros` no ambiente de simulação, sintaxe plpgsql revisada só por leitura.
- `npm run build` (Vite): sem `node_modules`.
- `npm run test:unit` completo: não executado em bloco. Os testes antigos `icones`, `investimentos-page`, `investimentos-robustez` e `onboarding-componente` falham também em `main` e não foram mascarados nem corrigidos.
- E2E no DEV (Playwright) e validação visual em celular e desktop, claro e escuro, do diálogo de motivo, do crédito e da lista de alterações.
- Aplicação da 000001 e da 000002 no DEV: não realizada. Produção não tocada.

Veredito mantido: **NÃO APROVADO PARA PRODUÇÃO**.

### 11.7 Tratamento da revisão 2026-11-25-020000 (veredito NEEDS_CHANGES)

Nada abaixo foi executado em PostgreSQL ou PGlite. As correções de SQL foram conferidas só por leitura; os testes novos estão escritos e **PENDENTES**. Só rodaram `node --check` nos `.mjs`, os testes node puros (saída 0: `historico-fatura`, `pagamento-fatura`, `fatura-cartao`, `fatura-detalhamento`, `paridade-fatura-js`, `valor-fatura-consumidores`, `saldo-disponivel`), `npm run test:concorrencia` (saída 2, PENDENTE) e uma checagem sintática com `tsc --noResolve` em `Cartoes.jsx` e `Despesas.jsx` (sem erros TS1xxx; não compila nem renderiza a tela).

| # | Problema | Tratamento |
|---|---|---|
| 1 | Inversão de ordem de locks em `alterar_historico_fatura` | **Corrigido.** A RPC trava TODOS os cartões do usuário em ordem ascendente de `id` antes de qualquer DML, a mesma ordem do trigger `aa_fatura_travar_usuario`. Cenário novo 18e (concorrência) com 2 cartões, 8 rodadas, RPC no cartão de maior id contra DML comum no de menor id; exige ausência de 40P01 e 55P03. **Não executado.** |
| 2 | Cascata de FK apaga razão e pagamentos estornados | **Corrigido.** `trg_fatura_proteger_cartao` agora recusa (FP001) excluir cartão com QUALQUER linha em `pagamentos_fatura` (inclusive estornada) ou em `ajustes_fatura`. Exceções: `zerar_dados_financeiros` (liberação transacional) e contexto administrativo (`auth.uid()` nulo, que inclui a exclusão de usuário em `auth.users`). Optou-se pelo trigger e não por `RESTRICT` na FK porque `RESTRICT` quebraria a cascata do zerar. Testes: simular-migrations (cartão com estorno e razão recusado; cartão sem histórico excluído) e cenário 18f. **Não executados.** Consequência de produto: um cartão que já recebeu pagamento só sai pelo "Zerar dados". |
| 3 | `cartoes.dia_fechamento` fora da guarda | **Corrigido, com restrição simples.** Novo trigger `ab_fatura_proteger_cartao_fechamento` (BEFORE UPDATE OF `dia_fechamento`) recusa a mudança (FP001) enquanto o cartão tiver pagamento ativo. Não se tentou calcular o total antes e depois da mudança: recusar é mais simples e seguro. Custo para o usuário: precisa estornar os pagamentos ativos antes de mudar o fechamento (a mensagem diz isso). Outros campos do cartão seguem editáveis. Testes em simular-migrations e cenário 18f; o cenário 16 antigo (sem pagamento ativo) continua válido. **Não executados.** |
| 4 | Dedupe parcelamento x compra escapa da guarda | **Corrigido (era possible; o risco foi tratado sem esperar a confirmação por teste).** `competencias_pagas_registro` agora inclui as competências da contraparte do dedupe (mesmo cartão, descrição normalizada, valor em centavos e nº de parcelas): para uma compra, os meses de parcelamentos não quitados equivalentes; para um parcelamento, os meses de compras equivalentes. Teste "dedupe" em simular-migrations (compra duplicata em outra competência recusada com FP001; descrição diferente permitida). **Não executado.** |
| 5 | Fluxo controlado incompleto no app | **Corrigido.** `handleSalvarFatura` (Cartoes.jsx) trata FP001: se já existe total informado do mês, abre o diálogo de motivo e repete por `atualizarComMotivo` de `useFaturasCartao` (agora usado); se não existe, mostra mensagem (a RPC não inclui). Em `Despesas.jsx`, editar, quitar e remover parcelamento tratam FP001 com diálogo de motivo e usam `atualizarComMotivo`/`removerComMotivo` de `useParcelamentos`. Editar e excluir cartão em Cartoes.jsx mostram a mensagem em português do banco quando é FP001 (itens 2 e 3). Sem teste automatizado de tela (não há `node_modules`); validação visual **PENDENTE**. |
| 6 | Releitura sob lock sem revalidar o cartão | **Corrigido.** Depois do lock (agora de todos os cartões, item 1) a RPC compara o `cartao_id` relido com o da leitura prévia e, se mudou, falha com 40001 (repetível). Com todos os cartões travados isso só ocorreria por DML sem `auth.uid()`. |
| 7 | Reaplicar a 000001 apaga a auditoria do estorno em silêncio | **Corrigido por falha explícita.** O bloco de pré-requisitos da 000001 recusa a execução (SQLSTATE 0A000, "Não reaplique a 000001") quando existe `estornar_pagamento_fatura(uuid,text)`. Efeito colateral aceito: com a 000002 aplicada, a idempotência da 000001 deixa de poder ser demonstrada por reaplicação direta. O teste agora (a) afirma que a reaplicação falha com a mensagem e (b) remove a função de 2 argumentos para simular o banco sem a 000002, reaplica a 000001 duas vezes (backfill idempotente) e reaplica a 000002. README atualizado. A ausência de campo de motivo do estorno na UI continua como está (o motivo é opcional; não foi pedido). **Não executados.** |
| 8 | Acúmulo em `_fatura_liberacoes` | **Corrigido.** `liberar_historico_zerar` e `alterar_historico_fatura` apagam, antes de inserir, as linhas do mesmo usuário de outras transações (sobras: a liberação legítima é apagada na própria transação e nunca chega a ser commitada; `txid_current()` tem 64 bits e não se repete) e qualquer linha com mais de 1 hora; `encerrar_liberacao_zerar` também poda. Resultado: no máximo 1 linha sobrando por usuário. Teste: 3 chamadas soltas deixam 1 linha; após o zerar sobram 0. **Não executado.** |
| 9 | Testes que não provariam as regras | **Corrigido na escrita; nenhum executado.** Negativos de privilégio (DELETE e UPDATE de pagamentos, INSERT/UPDATE/DELETE em `ajustes_fatura`, `SELECT` em `_fatura_liberacoes`, anônimo em RPCs) agora exigem SQLSTATE `42501`; motivo ausente, curto, tabela, coluna e ação inválidas exigem `22023`; estorno com motivo longo exige `22023`. Os casos "B não altera/apaga a compra de A" exigem `0` linhas sem erro; eles provam a RLS (a guarda só avalia linhas do próprio usuário), e isso está dito no nome do teste. Cenários acrescentados: guarda em `parcelamentos` e `faturas_cartao`; mover compra entre cartões (destino e origem quitados); parcial derrubando o total abaixo do pago por DML direto (crédito via `direto`); exclusão de cartão com e sem histórico; `dia_fechamento`; compra parcelada cruzando mês quitado e aberto (e compra após o fechamento); dedupe; acúmulo de liberações; reaplicação da 000001; concorrência com 2 cartões (18e) e cartão em conexão real (18f). **Ainda sem cenário:** RLS do consultor em `ajustes_fatura` (exige montar `consultoria_acessos` com um consultor autorizado e outro não; fica PENDENTE e registrado). Os testes feitos como dono (`db.query`) continuam exercitando o ramo administrativo; o ramo de usuário comum é coberto pelos cenários `como(A, ...)`. |

Nota sobre o risco que a revisão menciona de acesso por SQL arbitrário: segue como residual aceito (seção 11.2).

### 11.8 Tratamento da revisão 2026-11-25-030000 (veredito NEEDS_CHANGES)

Nada abaixo foi executado em PostgreSQL ou PGlite (sem Postgres, sem `node_modules`, sem rede). As correções de SQL foram conferidas só por leitura e o cenário novo está escrito e **PENDENTE**. Rodaram apenas `node --check` nos `.mjs` e `node tests/historico-fatura.test.mjs`. Nada é declarado aprovado.

| # | Problema | Tratamento |
|---|---|---|
| 1 | Corrida na guarda de `dia_fechamento`: o trigger de linha checava pagamento ativo antes de esperar o lock da linha e não via um pagamento ainda não commitado | **Corrigido por leitura.** Novo trigger de statement `aa_fatura_travar_usuario_fechamento` (BEFORE UPDATE OF `dia_fechamento` em `cartoes`) chama `trg_fatura_travar_usuario`, que trava todos os cartões do usuário em ordem ascendente antes de qualquer trigger de linha, o mesmo padrão do DELETE. O prefixo `aa_` roda antes de `ab_fatura_proteger_cartao_fechamento`, então a checagem acontece depois de esperar o commit do pagamento. Cenário novo **18g** em `concorrencia-fatura.mjs`: pagamento aberto e não commitado, UPDATE em outra sessão (confirma espera por lock em `pg_stat_activity`), commit do pagamento, exige FP001, sem 40P01, e `dia_fechamento` inalterado. **Não executado.** |
| 2 | Cartão com pagamento (inclusive `legado` do backfill da 000001) não pode ser excluído e a UI não oferece arquivar | **Decisão de produto ABERTA, sem alteração de código.** O backfill da 000001 cria pagamentos `legado` a partir do antigo `faturas_cartao.pago`; portanto cartões antigos que só tinham fatura marcada como paga também passam a ter exclusão recusada (FP001) e só saem por "Zerar dados". Alternativa possível: arquivar via `cartoes.ativo` (existe desde `20250124_proteger_exclusao_cartao.sql`; `useCartoes.js` não usa). Arquivamento não foi implementado, porque depende de o produto confirmar se "só sai pelo Zerar dados" é aceitável. |
| 3 | Documentação desatualizada | **Corrigido.** O cabeçalho da 000001 (linha "Idempotente") agora ressalva que, depois da 000002, o bloco de pré-requisitos aborta com 0A000 e a 000001 não deve ser reaplicada. `supabase/migrations/README.md` agora cita "13b e 18a a 18g". |
| 4 | Nenhum teste de banco executado | **Continua PENDENTE.** `npm run test:migrations` e `npm run test:concorrencia` (incluindo 18e, 18f e 18g) precisam rodar num Postgres descartável antes de qualquer aprovação de banco. Sem isso, a aprovação vale só para a leitura estática. |

Cenários dos itens que estavam sem cobertura (RLS do consultor, cartão com pagamento `legado`, savepoint) foram escritos na seção 12, todos PENDENTES; a contagem `ajustes` em savepoint foi corrigida (seção 12.2).

## 12. Revisão final direcionada (banco) e requisitos de validação

**Estado: nenhuma migration foi executada.** Nenhum item abaixo é aprovação de banco. Veredito "por leitura" significa só leitura do código.

### 12.1 O que foi executado (reverificado nesta etapa)

| Verificação | Comando | Saída real |
|---|---|---|
| Postgres local | `which psql initdb postgres pg_ctl` | nenhum encontrado |
| `PG_TEST_URL` | `echo $PG_TEST_URL` | vazio |
| Dependências npm | `ls node_modules` | `No such file or directory` |
| Registry | `npm ping` | `npm error 403 on a server you do not have access to` |
| DNS do DEV `fzawugbiojmtrthmshcc` | `getent hosts fzawugbiojmtrthmshcc.supabase.co` | sem resolução (sem credenciais também) |
| Docker | `docker info` | `could not find a working conmon binary` |
| Sintaxe | `node --check supabase/tests/simular-migrations.mjs` | sem erro (rodado de novo após a revisão 1 da revisão final) |

Nenhum bloqueio foi contornado. `ievccupeijzuzhomphwn.supabase.co` não foi acessado.

### 12.2 Resultado por item (leitura + cenário escrito)

| # | Pergunta | Veredito por leitura | Cenários (`simular-migrations.mjs`, seção "revisao final") | Execução |
|---|---|---|---|---|
| 1 | RLS do consultor em `ajustes_fatura` | A policy usa `consultor_autorizado(usuario_id)`, a mesma função das demais tabelas financeiras (`2026-10_consultoria_acessos.sql`). Esse critério é só `status = 'autorizado'` para o par consultor/cliente via `auth.uid()`: a tabela `consultoria_acessos` não tem expiração nem permissões por escopo, então não há o que testar além de status. Papel `authenticated` tem apenas SELECT; `anon` sem GRANT. Usa `auth.uid()` (GUC `request.jwt.claim.sub` no simulador; no Supabase real o claim vem de `request.jwt.claims`, o que o simulador não prova). | sem vínculo, pendente, recusado e revogado não leem; autorizado lê só o cliente autorizado; B não lê (com pré-condição de que B e outros usuários têm linhas na razão, semeando uma linha de B como dono se faltar); consultor sem INSERT/DELETE (42501); anon 42501; revogar tira o acesso | PENDENTE |
| 2 | Exclusão de cartão com pagamento legado | `trg_fatura_proteger_cartao` testa `EXISTS` em `pagamentos_fatura` sem filtro de `status` e de `legado`, então não depende de pagamentos ativos. Nenhum defeito. | legado ativo e legado estornado recusam (FP001); cascata administrativa em `auth.users` funciona. A cascata iniciada pelo próprio usuário não tem cenário: `cartoes.usuario_id` referencia `auth.users` (não `perfis`) e usuário comum não apaga `auth.users`, então o caso não é alcançável (um DELETE em `perfis` não cascateia para `cartoes` e o teste antigo era vacuoso, removido) | PENDENTE |
| 3 | `alterar_historico_fatura` em savepoint | **Defeito achado e corrigido:** a contagem `ajustes` usava `xmin = txid_current() % 2^32`. Dentro de SAVEPOINT as linhas novas levam o xid da subtransação, então a contagem saía 0. Agora conta por diferença com `criado_em = NOW()` (início da transação de nível superior). A liberação usa `txid_current()` (nível superior), portanto é consistente com savepoint, e o ROLLBACK TO desfaz a linha de `_fatura_liberacoes`. | sucesso + ROLLBACK TO; erro de dados (classe 22), 22023, 42501 + ROLLBACK TO; RELEASE + COMMIT; auditoria, ajustes, compra, pagamentos e liberações conferidos; DML direto depois do rollback segue FP001 | PENDENTE |
| 4 | Custo dos triggers em massa | Ver 12.3. Nenhuma garantia removida e nenhuma mudança de código. | benchmark opcional `BENCH=1 [BENCH_N=2000] node supabase/tests/simular-migrations.mjs` (só imprime tempo): cartão sem pagamento, mês quitado com inserções em outro mês e um caso com linhas dentro do mês quitado, sem liberação e com `auth.uid()` nulo (o único caminho que passa pela auditoria sem `alterar_historico_fatura`). Esse último caso foi escrito por leitura, nunca executado, e a guarda pode recusá-lo; até rodar, o caso lento não tem medida válida | PENDENTE |
| 5 | `liberar_historico_zerar` e `_fatura_liberacoes` | Identidade vem de `auth.uid()` (sem parâmetro); `SECURITY DEFINER` com `search_path = public, pg_temp`; linha vale só para `txid_current()` e o usuário; tabela com RLS sem policy e REVOKE de todos os papéis de cliente; `anon` sem EXECUTE; poda por usuário e por 1 hora. Residual aceito (já na seção 11): quem executa SQL arbitrário como o próprio usuário pode liberar e apagar o próprio histórico na mesma transação; via PostgREST cada RPC é uma transação, então por esse caminho não é alcançável. Outros caminhos que executam várias operações na mesma transação (conexão SQL direta; GraphQL via `pg_graphql`, se a extensão estiver ativa e a função exposta como mutation) não foram verificados: não há referência a `graphql` em `supabase/`, mas a configuração do projeto DEV não foi consultada. O impacto é a perda da rastreabilidade do próprio histórico do usuário (`usuario_id = auth.uid()` segue valendo, sem acesso a terceiros). Alternativa de desenho, não aplicada por mudar a semântica de RLS sem teste real: `zerar_dados_financeiros` como DEFINER com liberação interna e REVOKE de `liberar_historico_zerar`. PENDENTE: confirmar no DEV se `pg_graphql` está ligada. | authenticated sem SELECT/INSERT; anon sem EXECUTE; sem identidade 28000; liberação não vale na transação seguinte nem para outro usuário; ROLLBACK TO SAVEPOINT e `encerrar_liberacao_zerar` desfazem; linha INFO do residual | PENDENTE |

### 12.3 Custo dos triggers (leitura)

Por linha em `compras_cartao`, `parcelamentos` e `faturas_cartao`, de usuário autenticado:

- BEFORE `ab_fatura_guardar_historico`: até 2 chamadas a `fatura_liberacao_ativa` (consulta indexada por `txid` em `_fatura_liberacoes`), `competencias_pagas_registro` para OLD e NEW (leitura de `cartoes` por id e de `pagamentos_fatura` por `(cartao_id, ano_mes)`), e `_fatura_recusar_se_quitada` só para meses com pagamento.
- AFTER `zz_fatura_auditar_historico`: mais 1 `fatura_liberacao_ativa`, de novo `competencias_pagas_registro` para OLD e NEW, `_fatura_contexto` (mais 1 a 2 consultas de liberação) e, só quando há mês com pagamento, soma de pagamentos, `total_fatura_ciclo_servidor` e `reconciliar_credito_fatura` por mês.
- Statement: `aa_fatura_travar_usuario` trava os cartões do usuário uma vez por comando.

Avaliação (corrigida na iteração 3): `competencias_pagas_registro` lê `parcelamentos` (ou `compras_cartao`) do cartão filtrando por descrição normalizada, valor e parcelas, então sem otimização o custo por linha dependia do tamanho do outro lado do dedupe (importação de N parcelamentos num cartão com M compras: O(N x M), a confirmar com `EXPLAIN`). Otimização aplicada na 000002: saída cedo quando o cartão não tem nenhum pagamento ativo (a função só devolve meses com pagamento ativo, então o resultado é o mesmo, vazio). Com ela, em cartão sem mês pago o custo por linha é de cerca de 6 a 8 consultas por índice, linear em N. Em cartão com algum mês pago a varredura da contraparte continua a cada chamada (guarda e auditoria, OLD e NEW). Não executado: a otimização é por leitura e não foi testada. Em cartões com mês quitado, cada linha que cai no mês pago recalcula o total do ciclo (varre as compras do ciclo), o que é O(N x tamanho do ciclo) naquele mês. Esse é o gargalo previsto, e ele é o custo da garantia. Otimização segura sem executar: nenhuma (juntar as duas consultas de liberação ou cachear por transação mudaria a semântica de liberações criadas no meio do comando e não pôde ser verificado). Índices existentes cobrem os acessos (`idx_pagamentos_fatura_cartao_mes`, `idx_ajustes_fatura_cartao_mes`, `idx_fatura_liberacoes_txid`). Recomendação para importação grande: importar em lotes por cartão/mês aberto e medir com o benchmark antes de qualquer mudança. O benchmark tem um caso para linhas no mês quitado (sem liberação `zerar`, pois ela faz a guarda e a auditoria retornarem cedo e não mediria o recálculo), mas ele nunca foi executado e pode ser recusado pela guarda. Nenhum número foi medido: PENDENTE.

Limites de lote e tudo-ou-nada: uma linha em competência quitada levanta FP001 e desfaz o comando inteiro, sem indicar quais linhas passariam. Em importação em massa, dividir os lotes por competência aberta e manter cada lote pequeno o bastante para o `statement_timeout` do papel `authenticated` (valor a conferir no projeto; não medido). Nenhum tamanho de lote foi validado.

### 12.4 Achado fora do escopo da 000002

`supabase/tests/rls-security.test.sql` (pré-existente) usava a tabela inexistente `public.consultorias_acessos` (linhas 419, 429, 440, 534); a migration cria `public.consultoria_acessos`. **Corrigido** por renomeação nas 4 linhas (colunas `id`, `cliente_id`, `consultor_id`, `status` conferem com a migration). A correção é por leitura: o arquivo (pgTAP) não foi executado e pode ter outros defeitos. Os cenários novos de RLS do consultor ficam em `simular-migrations.mjs`.

### 12.4b Tratamento da revisão (iteração 1)

- Cascata do próprio usuário: cenário vacuoso removido; caso declarado inalcançável (12.2).
- Asserções negativas de RLS: pré-condições de linhas de B e de outros usuários adicionadas.
- `rls-security.test.sql`: nome da tabela corrigido (12.4).
- Bloco de liberações e residual: agora com try/catch/finally e ROLLBACK; falha vira FALHA registrada e não derruba o script.
- Linha final do simulador agora diz "simulação sem falhas (PGlite; não é aprovação de banco)".
- Benchmark: caso com linhas no mês quitado adicionado, sem números.

### 12.4c Tratamento da revisão (iteração 2)

- Bloco de liberações: removido o `const` que sombreava as quatro variáveis de resultado (as asserções comparavam `undefined`).
- Benchmark do mês quitado: deixou de usar `liberar_historico_zerar` (que fazia o trigger de auditoria retornar cedo) e passou a inserir com `auth.uid()` nulo. Escrito por leitura, não executado; sem medida.
- Cenário "sem identidade": `set_config` e `liberar_historico_zerar()` agora são chamadas separadas na mesma transação.
- Não coberto: a policy de INSERT de `consultoria_acessos` (só admin cria vínculo) e o bypass de `service_role` (uid nulo) na cascata administrativa. Risco aceito e registrado, sem cenário.
- Nada disso foi executado, nem em PGlite.
- Não corrigido: o cenário "sem identidade" chama `set_config` e `liberar_historico_zerar()` no mesmo SELECT e depende da ordem de avaliação da lista (apontado como possível). Falharia de forma visível se a ordem mudasse; mantido por falta de execução para validar uma alternativa.
- Nada disso foi executado em Postgres; PGlite também não rodou.

### 12.4d Tratamento da revisão (iteração 3)

- Custo por linha: texto de 12.3 corrigido e saída cedo adicionada em `competencias_pagas_registro` (sem remover trigger nem guarda). Não executada.
- Limite de lote e tudo-ou-nada documentados em 12.3.
- Bypass multi-operação: 12.2 item 5 não afirma mais inalcançabilidade geral; verificação de `pg_graphql` fica PENDENTE.
- `dados_antes` e `motivo` em `ajustes_fatura`: decisão aceita, não alterada. O consultor autorizado já lê as tabelas de origem e a razão é a trilha de auditoria do mesmo cliente; ele passa a ver também o conteúdo de registros editados ou excluídos. Se o produto não quiser isso, restringir colunas por view. Decisão de produto a confirmar.
- Cartão com pagamento legado: `Onboarding.jsx` e `Cartoes.jsx` agora anexam `e.hint` (que traz "use Zerar dados") à mensagem de erro de exclusão. Depende de o cliente Supabase repassar `hint` no erro; não verificado em execução.
- Nada acima foi executado em Postgres.

### 12.5 Não executado

Migrations 000001 e 000002 em Postgres, `npm run test:migrations`, `npm run test:concorrencia`, `rls-security.test.sql`, paridade SQL/JS (`supabase/tests/paridade-fatura.mjs`), `npm run build`, `npm run test:unit` completo, E2E e validação visual. Todos PENDENTE por falta de Postgres, `node_modules`, registry, Docker e acesso ao DEV. Quatro testes unitários antigos (icones, investimentos-page, investimentos-robustez, onboarding-componente) falham também em `main`; não foram mascarados.

### 12.6 Riscos residuais

- Nenhum SQL das migrations 000001 e 000002 nem dos cenários novos foi executado (erros de sintaxe, de ordem ou de SQLSTATE são possíveis). A correção do item 3 também não foi executada.
- O simulador define `auth.uid()` lendo `request.jwt.claim.sub`; o Supabase real lê `request.jwt.claims`. Teste de RLS com JWT real (`rls-security.test.sql` corrigido por leitura, ou PostgREST) segue pendente.
- Sem expiração de acesso do consultor no modelo atual (só `status`).
- Custo O(N x ciclo) em importação em meses já quitados (12.3).
- Liberação transacional abusável por SQL arbitrário do próprio usuário (residual aceito).

### 12.7 Requisitos mínimos para validar em PostgreSQL 13+ descartável (UTF8)

1. PostgreSQL 13 ou superior, banco novo e descartável, nunca produção nem DEV compartilhado: `initdb -D /tmp/pgdata --encoding=UTF8 --locale=C.UTF-8` (ou `createdb -E UTF8 -T template0 --locale=C.UTF-8 af_teste`). `SHOW server_encoding;` deve retornar `UTF8` (os nomes de policies e mensagens têm acentos).
2. Extensões: `uuid-ossp` e `pgcrypto` (`gen_random_uuid()` é nativo desde o PG 13); `pgtap` só para `rls-security.test.sql`.
3. Papéis: `CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;` e um papel de conexão que não seja superusuário para testar RLS (ou `SET LOCAL ROLE`).
4. Schema `auth` com `auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz)`, `auth.uid()` (lendo `request.jwt.claim.sub` e, para paridade com o Supabase, `request.jwt.claims->>'sub'`), `auth.role()` e `auth.jwt()`; schema `storage` com `buckets`, `objects` e `foldername`; `GRANT USAGE` nos schemas e `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES, FUNCTIONS TO anon, authenticated, service_role` (como no Supabase). Pré-requisito do consultor: `public.e_admin()`.
5. Ordem: `supabase/schema.sql` (ou os `staging/*.sql` quando existirem), depois as migrations por ordem de nome, com `2026-10_consultoria_acessos.sql` antes de `20261124000001_pagamentos_fatura.sql` e a 000001 antes da 000002. Nunca reaplique a 000001 depois da 000002.
6. Variável: `PG_TEST_URL=postgres://usuario:senha@host:5432/af_teste` para `test:concorrencia` (conexões reais). `test:migrations` usa PGlite e não precisa de servidor.
7. Comandos, nesta ordem, registrando cada saída:
   - `npm ci`
   - `npm run test:migrations` (simulador em PGlite, que não substitui PG 13 real para concorrência; o bloco de liberações foi corrigido por leitura e ainda não rodou, então falhas nele devem ser investigadas e não presumidas; paridade SQL/JS, compras); opcional `BENCH=1 BENCH_N=2000 node supabase/tests/simular-migrations.mjs`
   - `PG_TEST_URL=... npm run test:concorrencia`
   - `psql "$PG_TEST_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls-security.test.sql` (nome da tabela já corrigido por leitura, ver 12.4; ainda não executado, pode falhar por outros motivos)
   - `npm run build`, `npm run test:unit` (esperar as 4 falhas antigas), `npm run test:e2e` (com `npx playwright install`) e validação visual manual.
8. Só marque como aprovado o que tiver saída real registrada nesta seção.
