# Pagamento de faturas: relatório de implementação e testes

Branch: `feat/pagamento-faturas`. Nada foi enviado ao remoto e a produção não foi tocada.

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
- RPCs `SECURITY DEFINER` com `auth.uid()`: `pagar_fatura_cartao` e `estornar_pagamento_fatura`. A primeira trava o cartão (`FOR UPDATE`), valida o dono, devolve o pagamento original se a chave se repete (duplo clique, retry, outro dispositivo) e recusa soma de pagamentos acima do total do ciclo, data futura, valor <= 0 e origem inválida.
- Limitação: a fatura é projetada no cliente (compras e parcelamentos), então o total do ciclo (`p_total_ciclo`) vem do app. O servidor garante consistência por ciclo, mas não recalcula a fatura.
- **Saldo da conta é derivado, não gravado.** `calcularSaldoDisponivel` subtrai pagamentos ativos com origem `saldo_principal` e data depois do marco do saldo e até hoje. Pagar e estornar são, portanto, atômicos (uma linha). Pagamento não é despesa, então a compra não é contada duas vezes.
- Conta de origem: o app não tem tabela de contas (existe um único saldo informado). A escolha é entre "Saldo principal" (debita) e "Outra conta" (não altera o saldo do app, nome opcional).
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

`Calendario.jsx` usa uma chamada antiga de `gerarHorizonte` que não recebe compras nem faturas; não foi alterada.

## 6. Testes

### Executados de verdade (node puro, dados fictícios, sem rede)

Comando: `node tests/<arquivo>.test.mjs`.

| Arquivo | Resultado |
|---|---|
| `tests/fatura-cartao.test.mjs` (adaptado para importar a lib direto, sem Vite) | Aprovado |
| `tests/fatura-detalhamento.test.mjs` (caso 5.970,18 / 7.800,93) | Aprovado (falha no código antigo) |
| `tests/pagamento-fatura.test.mjs` (total, parcial, antecipado, estorno, carry-over, status, limite, saldo, duplicidade) | Aprovado |
| `tests/saldo-disponivel.test.mjs` | Aprovado |

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

## 7. Ordem de aplicação

1. DEV: aplicar `2026-11_pagamentos_fatura.sql` (depende de `faturas_cartao` com `pago`/`pago_em`, migrations de 2026-10). Reaplicar para confirmar idempotência.
2. Rodar a suíte acima no DEV e revisar os resultados.
3. Somente após aprovação: aplicar a mesma migration em produção e publicar o front-end. O front-end novo sem a migration mostra "migração ainda não aplicada" e segue funcionando sem pagamentos.
