# ============================================================
# Backup de segurança do Supabase (PRODUÇÃO) — Almeida Finance
# ============================================================
# Gera um backup COMPLETO (esquema + dados) do banco Postgres do Supabase ANTES
# de aplicar a migração de Metas + Investimentos. NÃO executa migração, NÃO
# altera o banco e NÃO publica nada.
#
# SEGURANÇA DE CREDENCIAIS:
#   - A string de conexão é lida da variável de ambiente SUPABASE_DB_URL.
#   - Ela NUNCA é escrita em arquivo, log ou saída de tela por este script.
#   - NÃO cole a senha como argumento na linha de comando (fica no histórico).
#
# COMO OBTER A CONNECTION STRING (sem expor no Git):
#   Supabase Studio -> Project Settings -> Database -> Connection string ->
#   formato "URI". Use a porta 5432 (conexão direta) para backup com dados.
#   Exemplo de formato (NÃO é credencial real):
#     postgresql://postgres:SUA_SENHA@db.SEU_REF.supabase.co:5432/postgres
#
# USO (PowerShell, nesta ordem):
#   $env:SUPABASE_DB_URL = Read-Host -AsSecureString ... (ver README abaixo)
#   .\scripts\backup-supabase.ps1
#
# Para passar a URL sem deixá-la no histórico do shell, use -AsSecureString:
#   $sec = Read-Host "Cole a SUPABASE_DB_URL" -AsSecureString
#   $env:SUPABASE_DB_URL = [System.Net.NetworkCredential]::new('', $sec).Password
#   .\scripts\backup-supabase.ps1
#   Remove-Item Env:\SUPABASE_DB_URL   # limpa a variável ao terminar
# ------------------------------------------------------------

param(
  # Pasta de destino FORA do repositório Git (padrão: ~\Backups\almeida-finance).
  [string]$DestDir = (Join-Path $env:USERPROFILE 'Backups\almeida-finance'),
  # Caminho do pg_dump (PostgreSQL 18 detectado na máquina).
  [string]$PgBin   = 'C:\Program Files\PostgreSQL\18\bin'
)

$ErrorActionPreference = 'Stop'

# 1) Pré-condições: ferramenta e credencial (sem expor a credencial).
$pgDump = Join-Path $PgBin 'pg_dump.exe'
if (-not (Test-Path $pgDump)) {
  Write-Error "pg_dump não encontrado em $PgBin. Ajuste -PgBin."
  exit 1
}
if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_URL)) {
  Write-Error "Defina a variável de ambiente SUPABASE_DB_URL antes de rodar (veja o cabeçalho deste script). A senha NÃO deve ir na linha de comando."
  exit 1
}

# 2) Destino fora do Git.
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
$stamp   = Get-Date -Format 'yyyy-MM-dd_HHmmss'
# Formato "custom" (-Fc): compactado e restaurável seletivamente com pg_restore.
$outFile = Join-Path $DestDir "almeida_backup_$stamp.dump"
$logFile = Join-Path $DestDir "almeida_backup_$stamp.log"

Write-Host "Gerando backup (esquema + dados) em: $outFile"
Write-Host "Destino fora do repositório Git. A connection string NÃO é registrada."

# 3) Dump completo. A URL vem da env var; não aparece em nenhum log.
#    --no-owner / --no-privileges facilitam a restauração em outro projeto.
& $pgDump --format=custom --verbose --no-owner --no-privileges `
  --file="$outFile" "$env:SUPABASE_DB_URL" 2> $logFile

if ($LASTEXITCODE -ne 0) {
  Write-Error "pg_dump falhou (código $LASTEXITCODE). Veja o log: $logFile (o log NÃO contém a senha)."
  exit $LASTEXITCODE
}

# 4) Integridade básica: o arquivo existe e tem tamanho > 0; lista o conteúdo.
if (-not (Test-Path $outFile) -or (Get-Item $outFile).Length -eq 0) {
  Write-Error "Arquivo de backup vazio ou ausente."
  exit 1
}
$sizeKB = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
Write-Host "Backup concluído: $sizeKB KB"

# 5) Verificação do conteúdo do dump (sem restaurar): lista objetos e confirma
#    a presença das tabelas essenciais. pg_restore -l lê só o índice do arquivo.
$toc = & (Join-Path $PgBin 'pg_restore.exe') -l "$outFile"
foreach ($t in @('metas','investimentos','perfis','receitas','despesas')) {
  if ($toc -match "TABLE .*\b$t\b") { Write-Host "OK  tabela presente no dump: $t" }
  else { Write-Host "ATENÇÃO  tabela não encontrada no índice do dump: $t" }
}

Write-Host ""
Write-Host "Backup salvo. Guarde este arquivo em local seguro (fora do Git)."
Write-Host "Para TESTAR a restauração num banco LOCAL vazio (NUNCA em produção):"
Write-Host "  veja scripts\restore-check.ps1"
