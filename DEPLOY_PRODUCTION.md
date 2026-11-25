# DEPLOY PRODUCTION - ALMEIDA FINANCE

## Alterações nesta versão
✅ Correção do alinhamento do login (+40% legibilidade)
✅ Logo redimensionado (32px desktop / 24px mobile)
✅ Espaçamento vertical otimizado
✅ Código preparado para sistema de pagamentos (inativo)
✅ Código preparado para Custo de Vida (inativo)

## Status dos sistemas
- **Sistema de Pagamentos**: Código pronto, aguardando migration em PROD
- **Custo de Vida**: Código pronto, aguardando validação em PROD
- **Novas funcionalidades**: Desabilitadas via flags (`SISTEMA_ATIVO = false`)

## Build
```bash
npm run build
```

## Deploy Vercel
```bash
git add .
git commit -m "prod: corrigir alinhamento login + preparar novos sistemas"
git push origin main
```

Vercel detecta automaticamente e faz deploy.

## Verificar após deploy
1. https://almeida-finance.vercel.app abre normalmente
2. Login funciona
3. Dashboard carrega
4. Menu lateral funciona
5. Todas funcionalidades existentes preservadas

## Próximos passos (após validar PROD)
1. Aplicar migration de pagamentos em PROD (similar ao DEV)
2. Ativar flags `SISTEMA_ATIVO = true`
3. Reabilitar rota `/custo-de-vida`
4. Novo deploy com funcionalidades completas

## Segurança
✅ Sem tabelas ausentes
✅ Sem quebra de funcionalidades existentes
✅ RLS preservado
✅ Sem exposição de credenciais
✅ Build testado localmente
