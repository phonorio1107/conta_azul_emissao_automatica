@echo off
REM Dois cliques aqui abrem o painel. Para fechar o painel, feche esta janela.
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando pela primeira vez, aguarde...
  call npm install
)
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
call npm run painel
pause
