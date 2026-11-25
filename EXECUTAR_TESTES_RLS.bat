@echo off
REM ============================================================
REM SCRIPT PARA EXECUTAR TESTES RLS
REM ============================================================
REM Configure as credenciais antes de executar
REM ============================================================

echo.
echo ============================================================
echo   TESTES RLS - Almeida Finance DEV
echo ============================================================
echo.
echo Este script executara 11 testes de RLS no ambiente DEV.
echo.
echo Certifique-se de que:
echo   1. Alice e Bob existem no Supabase DEV (gxfcfpdwyjqcrfssxgbi)
echo   2. Voce possui as senhas corretas para ambos
echo   3. Schema base foi executado com sucesso
echo.
echo ============================================================
echo.

REM Verificar se .env.test.local existe
if exist .env.test.local (
  echo [OK] Arquivo .env.test.local encontrado
  echo Usando credenciais do arquivo...
  echo.
  node testes-rls-com-credenciais.js
) else (
  echo [AVISO] Arquivo .env.test.local nao encontrado
  echo.
  echo Configure as credenciais via variaveis de ambiente:
  echo.
  echo   set ALICE_EMAIL=alice@example.com
  echo   set ALICE_PASSWORD=sua_senha_alice
  echo   set BOB_EMAIL=bob@example.com
  echo   set BOB_PASSWORD=sua_senha_bob
  echo   EXECUTAR_TESTES_RLS.bat
  echo.
  echo OU copie o arquivo de exemplo:
  echo.
  echo   copy .env.test.local.example .env.test.local
  echo   notepad .env.test.local
  echo   (edite com as senhas reais)
  echo   EXECUTAR_TESTES_RLS.bat
  echo.
  pause
)

echo.
echo ============================================================
echo   Testes finalizados
echo ============================================================
echo.
pause
