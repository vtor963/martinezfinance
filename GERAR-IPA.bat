@echo off
title Martinez Finance - Gerar IPA (iOS)
echo ========================================
echo  Martinez Finance - Build iOS (IPA)
echo ========================================
echo.
echo ATENCAO: instalar IPA no iPhone sem App Store
echo exige conta Apple Developer paga (US$ 99/ano).
echo Sem ela, use no iPhone: Safari -^> Compartilhar
echo -^> Adicionar a Tela de Inicio (vira um app
echo com icone, funciona offline na caixa).
echo.
echo Se voce TEM Apple Developer, continue:
echo.
call eas login
echo.
echo Gerando IPA na nuvem...
call eas build -p ios --profile production
echo.
pause
