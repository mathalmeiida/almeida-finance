$cal = [System.IO.File]::ReadAllText('C:\Users\MATHEUS\Desktop\App Financas\posso-comprar\src\pages\Calendario.jsx')
Write-Host $cal.Substring(0, 50)