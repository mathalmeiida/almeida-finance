# Importação Inteligente

Página `/importacao` (menu lateral "Finanças", botão "Adicionar" no celular e "Todas as funcionalidades").
Importa extratos bancários, faturas de cartão e extratos de investimentos em PDF com texto, CSV, OFX, XLS e XLSX.

## Antes de publicar

1. Aplicar `supabase/migrations/2026-11_importacao_inteligente.sql` no SQL Editor do Supabase (staging primeiro).
   A migration é idempotente e não altera dados existentes. Sem ela, a página mostra um aviso e nada é gravado.
2. Rodar os testes:
   - `npm run test:importacao` (motor de leitura: extrato, fatura, investimentos, validação de arquivos)
   - `npm run test:importacao-sql` (migration em Postgres local PGlite: RLS, validação, desfazer, retenção)

Nenhum serviço pago novo é usado: sem upload, sem Storage, sem Edge Function, sem IA externa, sem OCR.

## Como funciona

| Etapa | Onde roda |
|---|---|
| 1–5: identificar formato, extrair, reconhecer instituição, datas/valores, interpretar | Web Worker no aparelho (`src/lib/importacao/worker.js`) |
| 6–8: classificar, detectar duplicidades, prévia | Navegador, com dados lidos via RLS |
| Gravação | RPC `importacao_confirmar` (SECURITY INVOKER, uma transação) |

- O arquivo não sai do aparelho. O banco guarda apenas hash SHA-256, formato e tamanho.
- Leitura determinística. Valores nunca são estimados; dados incertos viram "Conferir".
- PDF digitalizado (sem texto) é recusado com orientação; não há OCR nesta versão.
- Detecta arquivo vazio, corrompido, protegido por senha (PDF, XLS, XLSX) e formato incompatível.
- Limites: 10 MB por arquivo, 5 arquivos, 5.000 linhas por arquivo, 60 páginas de PDF, 45 s de processamento, 2.000 itens por gravação.
- Planilhas: somente valores de células. Macros, fórmulas e objetos incorporados são ignorados.

## Regras financeiras

- **Extrato**: pagamento de fatura, aplicação/resgate de investimento e transferência entre contas próprias (inclusive PIX para o próprio nome) não viram despesa/receita.
- **Cartão**: compra parcelada vira UMA compra de origem com `numero_parcelas`; o app projeta as parcelas. Se a data não for coerente com a parcela indicada, o app sugere a data da compra original (o usuário decide). Parcela sem total vira valor único com pendência. Estornos e pagamentos não são gravados.
- **Investimentos**: movimentações entram no histórico com `afeta_saldo = false` (não somam ao valor da posição). A posição do extrato cria o investimento novo ou, para um investimento existente, é uma **conciliação** desmarcada por padrão que substitui o valor atual. Preço médio só é calculado quando compras − vendas do arquivo batem com a quantidade da posição.
- **Saldo**: o saldo final do extrato é só informativo; o saldo do app não é sobrescrito.

## Duplicidades

Pareamento 1-para-1 com os registros existentes:
- já importado antes (impressão digital) → "Já importado", desmarcado;
- mesma data, valor e descrição semelhante, ou coincidência com despesa/receita recorrente → "Provável", desmarcado;
- mesmo valor e data com descrição diferente → "Possível", continua marcado.

Opções por item: ignorar, manter os dois, complementar (preenche categoria vazia) ou substituir (não permitido para recorrentes).

## Aprendizado e privacidade

- Categoria escolhida é salva em `importacao_regras_categoria` (por usuário, RLS) e sugerida nas próximas importações.
- Histórico guardado por 365 dias e apagado automaticamente na próxima importação; o usuário também pode remover.
- Desfazer: remove o que a importação criou e restaura complementos/conciliações. Registros alterados depois, investimentos com novas movimentações ou metas são preservados.
