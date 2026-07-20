@echo off
setlocal

set ROOT=%~dp0
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%

echo Regenerating native Android project (picks up app.json changes: icon, permissions, plugins)...
call npx expo prebuild --platform android --clean
if errorlevel 1 (
    echo Prebuild failed!
    exit /b 1
)

echo Building release APK...
cd "%ROOT%\android"
call gradlew.bat assembleRelease
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)
cd "%ROOT%"

echo Forcing a clean reinstall so Android's launcher icon cache is not stale...
adb uninstall com.giamat90.readit
adb install "%ROOT%\android\app\build\outputs\apk\release\app-release.apk"

echo.
echo Done. Release build installed.
