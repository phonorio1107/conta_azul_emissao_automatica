@echo off
REM Dois cliques aqui abrem o arquivo de configuracao (.env) no Bloco de Notas.
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run configurar
