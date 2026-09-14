@echo off
title Martinez Finance - Gerar APK
echo ========================================
echo  Martinez Finance - Gerar APK Android
echo  Sem loja: instala direto no celular
echo ========================================
echo.
where eas >NUL 2>&1
if errorlevel 1 (
  echo Instalando EAS CLI (uma vez so)...
  call npm i -g eas-cli
)
echo.
echo PASSO 1: crie uma conta gratis em https://expo.dev/signup
echo PASSO 2: faca login quando pedir abaixo
echo.
call eas login
echo.
echo Gerando o APK na nuvem (leva de 10 a 20 min)...
echo No final aparece um LINK e um QR CODE para instalar.
call eas build -p android --profile preview
echo.
echo Terminou. Abra o link/QR no celular para instalar.
pause
