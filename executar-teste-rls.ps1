# Script para executar teste RLS real
# Autor: Kiro AI
# Data: 2026-01-26

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ALMEIDA FINANCE — TESTE RLS REAL" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este teste requer 2 contas confirmadas no Supabase." -ForegroundColor Yellow
Write-Host "Você precisará fornecer email e senha de ambas." -ForegroundColor Yellow
Write-Host ""

# Verificar se estamos no diretório correto
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Verificar se o arquivo de teste existe
if (-not (Test-Path "tests\teste-rls-real-definitivo.mjs")) {
    Write-Host "❌ Arquivo de teste não encontrado!" -ForegroundColor Red
    Write-Host "   Esperado: tests\teste-rls-real-definitivo.mjs" -ForegroundColor Red
    exit 1
}

# Verificar se node está instalado
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js detectado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js não encontrado!" -ForegroundColor Red
    Write-Host "   Instale Node.js: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Verificar dependências
if (-not (Test-Path "node_modules\@supabase\supabase-js")) {
    Write-Host "⚠️  Dependências não instaladas. Instalando..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "Executando teste..." -ForegroundColor Cyan
Write-Host ""

# Executar teste
node tests\teste-rls-real-definitivo.mjs

# Capturar código de saída
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✅ TESTE CONCLUÍDO COM SUCESSO" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
} else {
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  ❌ TESTE FALHOU" -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Red
}
Write-Host ""

exit $exitCode
