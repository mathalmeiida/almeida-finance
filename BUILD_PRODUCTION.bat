@echo off
echo ========================================
echo BUILD PRODUCTION - ALMEIDA FINANCE
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando ambiente...
if not exist ".env.local" (
    echo ERRO: .env.local nao encontrado
    pause
    exit /b 1
)

findstr /C:"ievccupeijzuzhomphwn" .env.local >nul
if errorlevel 1 (
    echo ERRO: .env.local nao aponta para PRODUCAO
    pause
    exit /b 1
)

echo OK - Ambiente PRODUCAO configurado
echo.

echo [2/3] Executando build...
call npm run build
if errorlevel 1 (
    echo ERRO: Build falhou
    pause
    exit /b 1
)

echo.
echo [3/3] Verificando dist...
if not exist "dist\index.html" (
    echo ERRO: dist/index.html nao gerado
    pause
    exit /b 1
)

echo.
echo ========================================
echo BUILD CONCLUIDO COM SUCESSO
echo ========================================
echo.
echo Pronto para publicar na Vercel
echo.
pause
