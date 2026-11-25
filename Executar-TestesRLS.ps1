# ============================================================
# SCRIPT POWERSHELL PARA EXECUTAR TESTES RLS
# ============================================================
# Uso: .\Executar-TestesRLS.ps1
# ============================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  TESTES RLS - Almeida Finance DEV" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se .env.test.local existe
if (Test-Path ".env.test.local") {
    Write-Host "[OK] Arquivo .env.test.local encontrado" -ForegroundColor Green
    Write-Host "Usando credenciais do arquivo..." -ForegroundColor Gray
    Write-Host ""
    node testes-rls-com-credenciais.js
    exit $LASTEXITCODE
}

Write-Host "[AVISO] Arquivo .env.test.local não encontrado" -ForegroundColor Yellow
Write-Host ""
Write-Host "Escolha uma opção:" -ForegroundColor White
Write-Host ""
Write-Host "1. Criar arquivo .env.test.local agora (recomendado)" -ForegroundColor White
Write-Host "2. Fornecer credenciais via variáveis de ambiente" -ForegroundColor White
Write-Host "3. Cancelar" -ForegroundColor White
Write-Host ""

$escolha = Read-Host "Digite 1, 2 ou 3"

switch ($escolha) {
    "1" {
        # Criar .env.test.local
        Write-Host ""
        Write-Host "Criando arquivo .env.test.local..." -ForegroundColor Cyan
        
        if (!(Test-Path ".env.test.local.example")) {
            Write-Host "[ERRO] Arquivo .env.test.local.example não encontrado!" -ForegroundColor Red
            exit 1
        }
        
        Copy-Item ".env.test.local.example" ".env.test.local"
        
        Write-Host ""
        Write-Host "Arquivo criado!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Agora edite o arquivo .env.test.local com as senhas reais:" -ForegroundColor Yellow
        Write-Host "  notepad .env.test.local" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Depois execute novamente:" -ForegroundColor Yellow
        Write-Host "  .\Executar-TestesRLS.ps1" -ForegroundColor Gray
        Write-Host ""
        
        # Abrir no notepad
        $resposta = Read-Host "Deseja abrir o arquivo no Notepad agora? (s/n)"
        if ($resposta -eq "s" -or $resposta -eq "S") {
            notepad ".env.test.local"
        }
    }
    
    "2" {
        # Usar variáveis de ambiente
        Write-Host ""
        Write-Host "Configure as variáveis de ambiente:" -ForegroundColor Cyan
        Write-Host ""
        
        # Inicializar variáveis para garantir limpeza no finally
        $aliceEmail = $null
        $bobEmail = $null
        $alicePassword = $null
        $bobPassword = $null
        $alicePasswordPlain = $null
        $bobPasswordPlain = $null
        $aliceBSTR = [IntPtr]::Zero
        $bobBSTR = [IntPtr]::Zero
        $exitCode = 0
        
        try {
            # Ler emails
            $aliceEmail = Read-Host "Email de Alice [alice@example.com]"
            if ([string]::IsNullOrWhiteSpace($aliceEmail)) {
                $aliceEmail = "alice@example.com"
            }
            
            # Ler senha de Alice (SecureString)
            $alicePassword = Read-Host "Senha de Alice" -AsSecureString
            $aliceBSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($alicePassword)
            $alicePasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($aliceBSTR)
            
            $bobEmail = Read-Host "Email de Bob [bob@example.com]"
            if ([string]::IsNullOrWhiteSpace($bobEmail)) {
                $bobEmail = "bob@example.com"
            }
            
            # Ler senha de Bob (SecureString)
            $bobPassword = Read-Host "Senha de Bob" -AsSecureString
            $bobBSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($bobPassword)
            $bobPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bobBSTR)
            
            Write-Host ""
            Write-Host "Executando testes..." -ForegroundColor Cyan
            Write-Host ""
            
            # Configurar variáveis de ambiente temporárias
            $env:ALICE_EMAIL = $aliceEmail
            $env:ALICE_PASSWORD = $alicePasswordPlain
            $env:BOB_EMAIL = $bobEmail
            $env:BOB_PASSWORD = $bobPasswordPlain
            
            # Executar testes e preservar exit code imediatamente
            node testes-rls-com-credenciais.js
            $exitCode = $LASTEXITCODE
            
        } finally {
            # Limpar variáveis de ambiente
            Remove-Item Env:ALICE_EMAIL -ErrorAction SilentlyContinue
            Remove-Item Env:ALICE_PASSWORD -ErrorAction SilentlyContinue
            Remove-Item Env:BOB_EMAIL -ErrorAction SilentlyContinue
            Remove-Item Env:BOB_PASSWORD -ErrorAction SilentlyContinue
            
            # Liberar buffers BSTR da memória não gerenciada
            if ($aliceBSTR -ne [IntPtr]::Zero) {
                [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($aliceBSTR)
            }
            if ($bobBSTR -ne [IntPtr]::Zero) {
                [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bobBSTR)
            }
            
            # Limpar variáveis locais com senhas
            if ($alicePasswordPlain) {
                $alicePasswordPlain = $null
            }
            if ($bobPasswordPlain) {
                $bobPasswordPlain = $null
            }
            if ($alicePassword) {
                $alicePassword.Dispose()
                $alicePassword = $null
            }
            if ($bobPassword) {
                $bobPassword.Dispose()
                $bobPassword = $null
            }
            
            # Forçar coleta de lixo para limpar memória sensível
            [System.GC]::Collect()
            [System.GC]::WaitForPendingFinalizers()
        }
        
        exit $exitCode
    }
    
    "3" {
        Write-Host ""
        Write-Host "Cancelado." -ForegroundColor Gray
        exit 0
    }
    
    default {
        Write-Host ""
        Write-Host "[ERRO] Opção inválida!" -ForegroundColor Red
        exit 1
    }
}
