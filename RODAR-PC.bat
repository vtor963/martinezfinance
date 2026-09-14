@echo off
title Martinez Finance - Teste no PC e Celular
echo ========================================
echo  Martinez Finance - Teste no PC e Celular
echo  Mesmo app de Android e iOS
echo ========================================
echo.
echo Atualizando para a ultima versao...
call npx expo export --platform web --output-dir dist-web
call node scripts\pwa-patch.js
echo.
echo Abrindo no PC: http://localhost:8081
timeout /t 2 >NUL
start http://localhost:8081
set LANIP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
  for /f "tokens=1" %%b in ("%%a") do (
    echo %%b| findstr /b "10\. 192\.168\." >NUL
    if not errorlevel 1 if not defined LANIP set LANIP=%%b
  )
)
if defined LANIP (
  echo.
  echo  No CELULAR (mesmo Wi-Fi), abra:
  echo  http://%LANIP%:8081
  echo  iPhone: Safari -^> Compartilhar -^> Adicionar a Tela de Inicio
  echo  Android: Chrome -^> menu -^> Adicionar a tela inicial
)
echo.
echo Servidor rodando. Deixe esta janela aberta.
echo Para fechar, aperte CTRL+C.
python -m http.server 8081 --bind 0.0.0.0 --directory dist-web
pause
