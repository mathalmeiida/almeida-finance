@echo off
REM ============================================================
REM EXECUTAR TESTES DO ONBOARDING - VALIDACAO FINAL
REM ============================================================

echo.
echo ============================================================
echo   TESTES ONBOARDING - Almeida Finance DEV
echo ============================================================
echo.
echo Usuario: teste.onboarding@almeida.dev
echo Ambiente: DEV (gxfcfpdwyjqcrfssxgbi)
echo.
echo ============================================================
echo   ATENCAO: Configure a senha antes de continuar
echo ============================================================
echo.

REM Verificar se senha foi definida
if "%TEST_PASSWORD%"=="" (
    echo [ERRO] Variavel TEST_PASSWORD nao definida!
    echo.
    echo Configure a senha do usuario de teste:
    echo   set TEST_PASSWORD=SuaSenhaAqui
    echo.
    echo Depois execute novamente este script.
    echo.
    pause
    exit /b 1
)

echo [OK] Senha configurada via TEST_PASSWORD
echo.

REM Verificar se servidor dev esta rodando
netstat -ano | findstr :5173 >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Servidor dev nao esta rodando
    echo.
    echo Iniciando servidor em background...
    start /B npm run dev
    echo Aguardando servidor iniciar...
    timeout /t 10 /nobreak >nul
    echo.
)

echo [OK] Servidor dev rodando em http://localhost:5173
echo.
echo ============================================================
echo   Executando 8 testes Playwright
echo ============================================================
echo.

REM Executar testes
npx playwright test tests/e2e/onboarding-completo.spec.js --headed

REM Capturar resultado
set TEST_RESULT=%errorlevel%

echo.
echo ============================================================
if %TEST_RESULT% equ 0 (
    echo   TESTES CONCLUIDOS COM SUCESSO
    echo   8/8 testes aprovados
) else (
    echo   TESTES FALHARAM
    echo   Codigo de saida: %TEST_RESULT%
)
echo ============================================================
echo.

pause
exit /b %TEST_RESULT%
