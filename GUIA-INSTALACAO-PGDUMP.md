# GUIA DE INSTALACAO — pg_dump para Windows

**Objetivo:** Instalar cliente PostgreSQL para criar backup do Almeida Finance 2.0

---

## OPCAO 1: Instalacao Oficial PostgreSQL (RECOMENDADO)

### Passo 1: Download

1. Acessar: https://www.postgresql.org/download/windows/
2. Clicar em "Download the installer"
3. Escolher versao **PostgreSQL 16.x** (compativel com Supabase)
4. Baixar instalador para Windows x86-64

### Passo 2: Instalacao

1. Executar instalador `postgresql-16.x-windows-x64.exe`
2. Tela "Select Components":
   - [X] Command Line Tools (OBRIGATORIO - contem pg_dump)
   - [ ] PostgreSQL Server (OPCIONAL - nao necessario para backup)
   - [ ] pgAdmin 4 (OPCIONAL)
   - [ ] Stack Builder (OPCIONAL)
3. Pasta de instalacao: `C:\Program Files\PostgreSQL\16`
4. Senha do superusuario: (nao necessaria para backup remoto)
5. Porta: 5432 (padrao, nao sera usada)
6. Locale: Portuguese, Brazil (ou Default)
7. Concluir instalacao

### Passo 3: Adicionar ao PATH

**Metodo 1 - Automatico (preferido):**

```powershell
# Executar como Administrador
$pgPath = "C:\Program Files\PostgreSQL\16\bin"
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$pgPath", "Machine")
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine")
```

**Metodo 2 - Manual:**

1. Abrir "Editar as variaveis de ambiente do sistema"
2. Botao "Variaveis de Ambiente"
3. Secao "Variaveis do sistema" > Variavel "Path" > Editar
4. Novo > Adicionar: `C:\Program Files\PostgreSQL\16\bin`
5. OK > OK > OK
6. **Reiniciar PowerShell**

### Passo 4: Validar Instalacao

```powershell
# Reabrir PowerShell (novo terminal)
pg_dump --version
```

**Resultado esperado:**
```
pg_dump (PostgreSQL) 16.x
```

**Tempo total:** ~10 minutos

---

## OPCAO 2: Instalacao via Chocolatey

### Passo 1: Instalar Chocolatey

```powershell
# Executar como Administrador
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

### Passo 2: Instalar PostgreSQL

```powershell
# Executar como Administrador
choco install postgresql16 -y --params '/Password:Admin123 /Port:5432'
```

### Passo 3: Validar

```powershell
# Reabrir PowerShell (novo terminal)
pg_dump --version
```

**Tempo total:** ~15 minutos

---

## OPCAO 3: Instalacao Portable (SEM INSTALADOR)

### Passo 1: Download Portable

1. Acessar: https://www.enterprisedb.com/download-postgresql-binaries
2. Baixar versao 16.x > Windows x86-64 > ZIP
3. Extrair para: `C:\PostgreSQL-Portable`

### Passo 2: Adicionar ao PATH (Temporario)

```powershell
$env:Path = "C:\PostgreSQL-Portable\pgsql\bin;" + $env:Path
pg_dump --version
```

**Nota:** PATH temporario (valido apenas na sessao atual do PowerShell)

**Tempo total:** ~5 minutos

---

## VERIFICACAO FINAL

Executar em PowerShell:

```powershell
# Verificar pg_dump
pg_dump --version

# Verificar pg_restore
pg_restore --version

# Testar conexao (substitua [PASSWORD])
pg_dump "postgresql://postgres.ievccupeijzuzhomphwn:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" --version
```

**Se tudo funcionar:**
- Prosseguir para ETAPA 2 do backup

**Se houver erros:**
- Verificar PATH
- Reiniciar PowerShell
- Executar como Administrador

---

## PROXIMOS PASSOS

Apos instalacao bem-sucedida:

1. Obter senha do banco Supabase (Dashboard > Settings > Database)
2. Executar script de backup
3. Validar arquivo gerado

---

**Tempo estimado total:** 10-15 minutos (Opcao 1 recomendada)
