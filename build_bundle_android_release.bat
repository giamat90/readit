@echo off
setlocal

set ROOT=%~dp0
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%

:: Use -File (not -Command) to avoid cmd.exe mangling parentheses
for /f "usebackq tokens=1,2" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\build_get_version.ps1" -Root "%ROOT%"`) do (
    set VERSION_NAME=%%a
    set VERSION_CODE=%%b
)

echo Building bundle v%VERSION_NAME% (%VERSION_CODE%)...

:: Pass versions as Gradle properties
cd "%ROOT%\android"
call gradlew.bat bundleRelease -PappVersionCode=%VERSION_CODE% -PappVersionName=%VERSION_NAME%
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)

:: Create output folder and move artifact
if not exist "%ROOT%\Bundles" mkdir "%ROOT%\Bundles"

set DEST=%ROOT%\Bundles\app-release-v%VERSION_NAME%-%VERSION_CODE%.aab
move /Y "%ROOT%\android\app\build\outputs\bundle\release\app-release.aab" "%DEST%"

echo.
echo Bundle saved to: %DEST%
