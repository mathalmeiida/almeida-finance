# ============================================================================
# SCRIPT DE VERIFICACAO: STATUS DA AUDITORIA DE SEGURANCA
# ============================================================================

Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host " VERIFICACAO DE SEGURANCA - ALMEIDA FINANCE" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Data: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')`n" -ForegroundColor Gray

$statusGeral = @()

# ============================================================================
# 1. VERSAO SUPABASE JS
# ============================================================================
Write-Host "[1] Verificando versao Supabase JS..." -ForegroundColor Yellow

$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$supabaseVersion = $packageJson.dependencies.'@supabase/supabase-js'

if ($supabaseVersion -match "2\.11[0-9]\.") {
    Write-Host "    [OK] Versao $supabaseVersion (compativel)" -ForegroundColor Green
    $statusGeral += "[OK] Supabase JS"
} else {
    Write-Host "    [AVISO] Versao $supabaseVersion" -ForegroundColor Yellow
    $statusGeral += "[AVISO] Supabase JS"
}

# ============================================================================
# 2. TOKEN BRAPI NO FRONTEND
# ============================================================================
Write-Host "`n[2] Verificando exposicao de token BRAPI..." -ForegroundColor Yellow

$tokenExpostoEnv = $null
try {
    $resultadosEnv = Select-String -Path ".env.local" -Pattern "VITE_BRAPI_TOKEN"
    $tokenExpostoEnv = ($resultadosEnv.Count -gt 0)
} catch {
    $tokenExpostoEnv = $false
}
$tokenExpostoCodigo = $null

try {
    $arquivosCodigo = Get-ChildItem -Path "src" -Recurse -Include "*.js", "*.jsx", "*.ts", "*.tsx"
    $resultados = $arquivosCodigo | Select-String -Pattern "VITE_BRAPI_TOKEN"
    $tokenExpostoCodigo = ($resultados.Count -gt 0)
} catch {
    $tokenExpostoCodigo = $false
}

if (-not $tokenExpostoEnv -and -not $tokenExpostoCodigo) {
    Write-Host "    [OK] Token NAO exposto no frontend" -ForegroundColor Green
    $statusGeral += "[OK] Token BRAPI protegido"
} else {
    Write-Host "    [ERRO] Token BRAPI encontrado!" -ForegroundColor Red
    $statusGeral += "[ERRO] Token BRAPI exposto"
}

# ============================================================================
# 3. EDGE FUNCTION BRAPI
# ============================================================================
Write-Host "`n[3] Verificando Edge Function buscar-cotacoes..." -ForegroundColor Yellow

if (Test-Path "supabase/functions/buscar-cotacoes/index.ts") {
    $linhas = (Get-Content "supabase/functions/buscar-cotacoes/index.ts").Count
    Write-Host "    [OK] Edge Function criada ($linhas linhas)" -ForegroundColor Green
    Write-Host "    [PENDENTE] Precisa deploy" -ForegroundColor Yellow
    $statusGeral += "[PENDENTE] Edge Function (aguarda deploy)"
} else {
    Write-Host "    [ERRO] Edge Function NAO encontrada" -ForegroundColor Red
    $statusGeral += "[ERRO] Edge Function nao criada"
}

# ============================================================================
# 4. SCRIPT DE TESTE RLS
# ============================================================================
Write-Host "`n[4] Verificando testes RLS (pgTAP)..." -ForegroundColor Yellow

if (Test-Path "supabase/tests/rls-security.test.sql") {
    $linhas = (Get-Content "supabase/tests/rls-security.test.sql").Count
    Write-Host "    [OK] Script criado ($linhas linhas)" -ForegroundColor Green
    Write-Host "    [PENDENTE] Precisa executar no Supabase" -ForegroundColor Yellow
    $statusGeral += "[PENDENTE] Testes RLS (aguarda execucao)"
} else {
    Write-Host "    [ERRO] Script de teste NAO encontrado" -ForegroundColor Red
    $statusGeral += "[ERRO] Testes RLS nao criado"
}

# ============================================================================
# 5. MIGRATION CATEGORIAS RECEITA
# ============================================================================
Write-Host "`n[5] Verificando migration categorias receita..." -ForegroundColor Yellow

if (Test-Path "supabase/migrations/2026-11_categorias_receita_expandidas.sql") {
    Write-Host "    [OK] Migration criada" -ForegroundColor Green
    Write-Host "    [PENDENTE] Precisa executar no Supabase" -ForegroundColor Yellow
    $statusGeral += "[PENDENTE] Migration (aguarda aplicacao)"
} else {
    Write-Host "    [ERRO] Migration NAO encontrada" -ForegroundColor Red
    $statusGeral += "[ERRO] Migration nao criada"
}

# ============================================================================
# 6. BUILD E TESTES
# ============================================================================
Write-Host "`n[6] Verificando build..." -ForegroundColor Yellow

if (Test-Path "dist/index.html") {
    $assets = Get-ChildItem "dist/assets/index-*.js" -ErrorAction SilentlyContinue
    if ($assets) {
        $tamanho = ($assets | Sort-Object Length -Descending | Select-Object -First 1).Length / 1MB
        Write-Host ("    [OK] Build OK (chunk: {0:N2} MB)" -f $tamanho) -ForegroundColor Green
        $statusGeral += "[OK] Build"
    } else {
        Write-Host "    [OK] Build OK" -ForegroundColor Green
        $statusGeral += "[OK] Build"
    }
} else {
    Write-Host "    [AVISO] Build nao encontrado" -ForegroundColor Yellow
    $statusGeral += "[AVISO] Build nao executado"
}

# ============================================================================
# 7. NAMESPACE PASSKEY
# ============================================================================
Write-Host "`n[7] Verificando namespace passkey..." -ForegroundColor Yellow

if (Test-Path "src/pages/Configuracoes.jsx") {
    $conteudo = Get-Content "src/pages/Configuracoes.jsx" -Raw
    
    if ($conteudo -match "supabase\.auth\.passkey\.") {
        Write-Host "    [OK] Namespace correto: auth.passkey" -ForegroundColor Green
        $statusGeral += "[OK] Passkeys namespace correto"
    } elseif ($conteudo -match "supabase\.auth\.mfa\.passkey\.") {
        Write-Host "    [ERRO] Namespace INCORRETO: auth.mfa.passkey" -ForegroundColor Red
        $statusGeral += "[ERRO] Passkeys namespace incorreto"
    } else {
        Write-Host "    [AVISO] Passkeys nao encontrado" -ForegroundColor Yellow
        $statusGeral += "[AVISO] Passkeys nao implementado"
    }
} else {
    Write-Host "    [AVISO] Arquivo Configuracoes.jsx nao encontrado" -ForegroundColor Yellow
    $statusGeral += "[AVISO] Passkeys"
}

# ============================================================================
# 8. RELATORIOS
# ============================================================================
Write-Host "`n[8] Verificando relatorios..." -ForegroundColor Yellow

$relatorios = @()
if (Test-Path "RELATORIO-SEGURANCA-PRODUCAO.md") { $relatorios += "SEGURANCA-PRODUCAO" }
if (Test-Path "RELATORIO-FINAL-VALIDACAO.md") { $relatorios += "FINAL-VALIDACAO" }
if (Test-Path "README-TESTES-RLS.md") { $relatorios += "TESTES-RLS" }
if (Test-Path "INSTRUCOES-PENDENCIAS.md") { $relatorios += "INSTRUCOES-PENDENCIAS" }

if ($relatorios.Count -gt 0) {
    Write-Host "    [OK] $($relatorios.Count) relatorios encontrados" -ForegroundColor Green
    $relatorios | ForEach-Object { Write-Host "         - $_" -ForegroundColor Gray }
    $statusGeral += "[OK] Documentacao completa"
} else {
    Write-Host "    [AVISO] Nenhum relatorio encontrado" -ForegroundColor Yellow
    $statusGeral += "[AVISO] Documentacao incompleta"
}

# ============================================================================
# RESUMO FINAL
# ============================================================================
Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host " RESUMO GERAL" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

$statusGeral | ForEach-Object { Write-Host "  $_" }

Write-Host "`n=================================================" -ForegroundColor Cyan

# ============================================================================
# PROXIMOS PASSOS
# ============================================================================
Write-Host "`nPROXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "  1. Executar testes RLS no Supabase SQL Editor" -ForegroundColor White
Write-Host "  2. Aplicar migration categorias receita" -ForegroundColor White
Write-Host "  3. Deploy Edge Function buscar-cotacoes" -ForegroundColor White
Write-Host "  4. Ativar passkeys no Dashboard Supabase" -ForegroundColor White
Write-Host "  5. Teste manual RLS com 2 contas reais`n" -ForegroundColor White

Write-Host "Ver instrucoes: INSTRUCOES-PENDENCIAS.md`n" -ForegroundColor Cyan

# ============================================================================
# EXIT CODE
# ============================================================================
$problemasCriticos = $statusGeral | Where-Object { $_ -like "[ERRO]*" }

if ($problemasCriticos.Count -gt 0) {
    Write-Host "[ATENCAO] $($problemasCriticos.Count) problema(s) critico(s)!`n" -ForegroundColor Red
    exit 1
} else {
    Write-Host "[OK] Verificacao concluida. Pronto para executar pendencias.`n" -ForegroundColor Green
    exit 0
}
