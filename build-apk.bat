@echo off
setlocal

set "ROOT=%~dp0"
set "JAVA_HOME=%ROOT%.tools\jdk-17.0.20+8"
set "ANDROID_HOME=%ROOT%.tools\android-sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"
set "APK=%ROOT%apps\mobile\android\app\build\outputs\apk\release\app-release.apk"
set "SHARE_DIR=%ROOT%apk"
set "SHARE_APK=%SHARE_DIR%\tixpay-latest.apk"

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo Java was not found at:
  echo %JAVA_HOME%
  pause
  exit /b 1
)

if not exist "%ANDROID_HOME%\platform-tools\adb.exe" (
  echo Android SDK was not found at:
  echo %ANDROID_HOME%
  pause
  exit /b 1
)

pushd "%ROOT%apps\mobile\android"
call gradlew.bat app:assembleRelease --console=plain -PreactNativeArchitectures=arm64-v8a -x ":expo-modules-core:configureCMakeRelWithDebInfo[arm64-v8a]" -x ":expo-modules-core:buildCMakeRelWithDebInfo[arm64-v8a]"
set "BUILD_EXIT=%ERRORLEVEL%"
popd

if not "%BUILD_EXIT%"=="0" (
  echo.
  echo APK build failed.
  pause
  exit /b %BUILD_EXIT%
)

if not exist "%APK%" (
  echo APK build completed, but the APK file was not found:
  echo %APK%
  pause
  exit /b 1
)

if not exist "%SHARE_DIR%" mkdir "%SHARE_DIR%"
copy /Y "%APK%" "%SHARE_APK%" >nul

echo.
echo APK ready:
echo %SHARE_APK%
echo.
pause
