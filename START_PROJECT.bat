@echo off
setlocal

cd /d "%~dp0backend"
netstat -ano | findstr /R /C:":5000 .*LISTENING" >nul
if errorlevel 1 start "Skill Test Backend" cmd /k "npm start"

timeout /t 3 /nobreak >nul
start "" "http://localhost/skill-test-system/frontend/build/"

endlocal
