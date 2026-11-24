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
| 1 | Total do ciclo confiado ao cliente | **Resolvido na quarta etapa (seção 9).** O servidor calcula o total do ciclo; o valor enviado pelo cliente é só uma dica e, se divergir, o pagamento é recusado. A âncora de total continua removida, então nova compra após pagamento parcial segue permitida sem estorno. |
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
2. **Âncora de total removida da RPC.** O teto é o total atual do ciclo (a partir da quarta etapa, calculado no servidor); pagamentos ativos são preservados e nova compra após pagamento parcial é permitida sem estorno (em aberto = total - pago). `total_ciclo_ref` é snapshot. Se o total cair abaixo do pago, o em aberto é 0 e o app expõe `excedentePago`; nada é debitado a mais.
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

- **Função SQL do total**: `public.total_fatura_ciclo_servidor(cartao, usuario, ano_mes)` em `supabase/migrations/2026-11_pagamentos_fatura.sql`. Recebe o usuário como parâmetro, então `EXECUTE` é revogado de `PUBLIC`, `anon` e `authenticated`; só as RPCs `SECURITY DEFINER` a chamam, sempre com `auth.uid()`. Todas as consultas filtram por `usuario_id`.
- **Função pública**: `public.total_fatura_ciclo(cartao, ano_mes)` usa só `auth.uid()` e recusa cartão de outro usuário (erro 42501). Não expõe dados de terceiros.
- **Regras reproduzidas de `src/lib/faturaCartao.js`**: competência pelo dia de fechamento (limitado ao último dia de meses curtos); parcelas em centavos com o resto na última; parcelamentos pela data da 1ª parcela com a mesma regra de fechamento; parcelamentos quitados fora; dedupe parcelamento x compra (mesmo cartão, descrição normalizada sem acentos latinos, valor e nº de parcelas); pagamentos de um ciclo nunca abatem outro.
- **Fatura informada (override)**: entra no cálculo, como no app (total = maior entre o informado e as compras). Decisão explícita: é o total que o app exibe e cobra, e o dado pertence ao próprio usuário (RLS), não ao parâmetro da RPC. O boolean legado `pago` não entra (virou pagamento legado no backfill).
- **`pagar_fatura_cartao`**: mesma assinatura. Depois do lock do cartão, calcula o total no servidor, soma os pagamentos ativos (anteriores preservados), exige total > 0 e saldo em aberto > 0, e recusa `p_valor` acima do em aberto (erro 22003 com o valor em aberto). `p_total_ciclo` virou dica: se vier e divergir do servidor, a RPC recusa com "Fatura desatualizada" (erro 40001); `NULL` é aceito. `total_ciclo_ref` guarda o total do servidor. Um cliente com tela desatualizada ou total adulterado não consegue pagar acima do devido.
- **Pagamentos parciais e novas compras**: pagamentos ativos nunca são alterados; nova compra sobe o total e o em aberto passa a ser total - pago, sem estorno.
- **Cliente**: `src/lib/mensagemPagamentoFatura.js` (módulo puro) traduz os erros; ao receber "fatura desatualizada", `Cartoes.jsx` recarrega compras, parcelamentos e faturas informadas, fecha o modal e mostra a mensagem para o usuário conferir o novo total.

### 9.2 Concorrência, idempotência, policy e mensagem de estorno

- **Concorrência**: `pagar` e `estornar` travam primeiro o cartão (`FOR UPDATE`) e depois a linha do pagamento (mesma ordem, sem deadlock). `UNIQUE (usuario_id, idempotency_key)` segue como barreira final e um `unique_violation` concorrente devolve o pagamento original quando os parâmetros coincidem. O `FOR UPDATE` em `cartoes` também bloqueia, pela checagem de chave estrangeira, o `INSERT` de `compras_cartao`, `parcelamentos` e `faturas_cartao` desse cartão até o commit. `UPDATE` e `DELETE` dessas tabelas não são travados: uma remoção que confirme depois da leitura do total permite pagar acima do novo total (risco residual declarado; `FOR NO KEY UPDATE` não resolveria isso e foi descartado). O teste de concorrência do PGlite usa uma conexão e não prova o lock.
- **Como aplicar a migration**: como transação única. O SQL Editor executa tudo como requisição única. O nome `2026-11_pagamentos_fatura.sql` não tem prefixo numérico de versão, então `supabase db push` não o reconhece. Em `psql`: `psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11_pagamentos_fatura.sql`; sem isso, o erro do bloco de pré-requisitos não impede os comandos seguintes. O cabeçalho da migration traz a mesma instrução.
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
| Migration no DEV e reaplicação (idempotência), incluindo a falha explícita sem `consultor_autorizado` | Aplicar `2026-10_consultoria_acessos.sql` e depois `supabase/migrations/2026-11_pagamentos_fatura.sql` no SQL Editor do DEV; rodar a segunda de novo |
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
