@echo off
REM ScaleSync Windows launcher.
REM Starts the Vite dev server (if not already running) and opens the app
REM in a chromeless Chrome/Edge window.

setlocal enableextensions

set "URL=http://localhost:5173"

REM --- repo root = two levels up from this script (scripts\windows\) ---
set "HERE=%~dp0"
pushd "%HERE%..\.."
set "REPO=%CD%"

REM --- logging ---
set "LOG_DIR=%LOCALAPPDATA%\ScaleSync"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
set "LOG=%LOG_DIR%\dev-server.log"

call :isUp && goto openBrowser

REM --- start dev server in hidden window ---
echo [%date% %time%] starting dev server >> "%LOG%"
powershell -noprofile -windowstyle hidden -command ^
  "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm run dev >> ""%LOG%"" 2>&1' -WorkingDirectory '%REPO%' -WindowStyle Hidden"

REM --- wait up to ~45s ---
set /a COUNT=0
:wait
call :isUp && goto openBrowser
set /a COUNT+=1
if %COUNT% GEQ 45 goto failed
timeout /t 1 /nobreak >nul
goto wait

:openBrowser
REM --- prefer Edge, then Chrome, then default browser ---
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" --start-fullscreen
  goto done
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" --start-fullscreen
  goto done
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%URL%" --start-fullscreen
  goto done
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="%URL%" --start-fullscreen
  goto done
)
start "" "%URL%"
goto done

:failed
powershell -noprofile -command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('ScaleSync could not start the dev server. Check %LOG%','ScaleSync','OK','Error') | Out-Null"
popd
exit /b 1

:done
popd
endlocal
exit /b 0

REM --- helper: probe whether http://localhost:5173 is serving ---
:isUp
powershell -noprofile -command "try { $r = Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop; exit 0 } catch { exit 1 }"
exit /b %errorlevel%
