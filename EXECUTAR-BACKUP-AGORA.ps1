# ============================================================
# BACKUP IMEDIATO - Almeida Finance 2.0
# Executa backup do banco de producao usando PostgreSQL 18
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " BACKUP MANUAL - Almeida Finance 2.0" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "  - Backup sera salvo em: C:\Users\MATHEUS\Desktop\App Financas\backups" -ForegroundColor White
Write-Host "  - Pasta FORA do repositorio Git (seguro)" -ForegroundColor White
Write-Host "  - Senha nao sera exibida nem salva" -ForegroundColor White
Write-Host ""
Write-Host "ANTES DE CONTINUAR:" -ForegroundColor Yellow
Write-Host "  1. Acesse: https://supabase.com/dashboard/project/ievccupeijzuzhomphwn" -ForegroundColor Cyan
Write-Host "  2. Menu: Settings > Database > Connection string" -ForegroundColor Cyan
Write-Host "  3. Modo: Transaction (porta 6543)" -ForegroundColor Cyan
Write-Host "  4. Copie a SENHA entre :[PASSWORD]@" -ForegroundColor Cyan
Write-Host ""

$continuar = Read-Host "Tem a senha pronta? (S/N)"
if ($continuar -ne "S" -and $continuar -ne "s") {
    Write-Host ""
    Write-Host "Obtenha a senha e execute este script novamente." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "Executando script de backup..." -ForegroundColor Green
Write-Host ""

# Executar script principal
& "$PSScriptRoot\scripts\backup-pgdump.ps1"
