# ============================================================
# Verificação de RESTAURAÇÃO do backup — Almeida Finance
# ============================================================
# Restaura um backup (.dump gerado por backup-supabase.ps1) num banco LOCAL e
# TEMPORÁRIO, só para CONFIRMAR que o backup é restaurável e que os dados vieram
# íntegros. NUNCA restaura em produção. NÃO altera o Supabase.
#
# PRÉ-REQUISITO: um PostgreSQL LOCAL funcional (psql/pg_restore) e um banco de
# destino vazio criado por você, cuja URL vai na env var LOCAL_DB_URL. A senha
# NÃO deve ir na linha de comando.
#
# USO:
#   $env:LOCAL_DB_URL = 'postgresql://postgres:senha@localhost:5432/restore_check'
#   .\scripts\restore-check.ps1 -DumpFile 'C:\...\almeida_backup_AAAA-MM-DD_HHMMSS.dump'
#   Remove-Item Env:\LOCAL_DB_URL
# ------------------------------------------------------------

param(
  [Parameter(Mandatory=$true)][string]$DumpFile,
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $DumpFile)) { Write-Error "Dump não encontrado: $DumpFile"; exit 1 }
if ([string]::IsNullOrWhiteSpace($env:LOCAL_DB_URL)) {
  Write-Error "Defina LOCAL_DB_URL apontando para um banco LOCAL vazio (nunca produção)."
  exit 1
}
$pgRestore = Join-Path $PgBin 'pg_restore.exe'
$psql      = Join-Path $PgBin 'psql.exe'

# 1) Restaura no banco local (limpando objetos antes; sem donos/privilégios).
Write-Host "Restaurando no banco LOCAL definido em LOCAL_DB_URL (não é produção)..."
& $pgRestore --clean --if-exists --no-owner --no-privileges `
  --dbname="$env:LOCAL_DB_URL" "$DumpFile"
# pg_restore pode retornar >0 por avisos benignos; seguimos para a conferência.

# 2) Conferência de integridade: contagem de linhas das tabelas-chave.
Write-Host "`nContagem de linhas após restauração:"
& $psql "$env:LOCAL_DB_URL" -c @"
SELECT 'metas' AS tabela, count(*) FROM public.metas
UNION ALL SELECT 'investimentos', count(*) FROM public.investimentos
UNION ALL SELECT 'perfis', count(*) FROM public.perfis
UNION ALL SELECT 'receitas', count(*) FROM public.receitas
UNION ALL SELECT 'despesas', count(*) FROM public.despesas;
"@

# 3) Checagem específica: os R$ 100 guardados na meta do iPhone continuam lá.
Write-Host "`nMetas com valor_atual > 0 (confirma, ex.: R\$ 100 no iPhone):"
& $psql "$env:LOCAL_DB_URL" -c @"
SELECT nome, valor_atual, valor_desejado
FROM public.metas
WHERE valor_atual > 0
ORDER BY valor_atual DESC;
"@

Write-Host "`nVerificação concluída. Compare os números acima com produção."
Write-Host "Ao terminar, descarte o banco local de teste."
