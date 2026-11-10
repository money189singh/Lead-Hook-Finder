@echo off
echo =========================================================
echo Building LeadHook Windows Installer (.exe)
echo =========================================================
echo.

REM Step 1: Install frontend dependencies
echo [1/4] Installing Node dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error during npm install!
    pause
    exit /b %errorlevel%
)

REM Step 2: Build frontend & server bundle
echo.
echo [2/4] Building production React client and Express bundle...
call npm run build
if %errorlevel% neq 0 (
    echo Error during npm run build!
    pause
    exit /b %errorlevel%
)

REM Step 3: Optional Python PyInstaller compilation
if exist "backend\requirements.txt" (
    echo.
    echo [3/4] Preparing Python crawler runtime...
    python -m pip install -r backend\requirements.txt
    python -m playwright install chromium
    pyinstaller --noconfirm --onedir --windowed --name "main" "backend\main.py"
    if exist "dist\main" (
        mkdir "backend\dist" 2>nul
        xcopy /s /e /y "dist\main" "backend\dist\"
    )
)

REM Step 4: Package with Electron Builder into single-click EXE installer
echo.
echo [4/4] Generating LeadHookSetup.exe and portable .exe...
npx electron-builder --win nsis portable
if %errorlevel% neq 0 (
    echo Error during electron packaging!
    pause
    exit /b %errorlevel%
)

echo.
echo =========================================================
echo SUCCESS! Single-click Windows Installer generated at:
echo dist_installer\LeadHookSetup.exe
echo dist_installer\LeadHook.exe
echo =========================================================
pause
