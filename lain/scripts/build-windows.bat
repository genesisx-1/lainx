@echo off
REM Windows Build Script for LAIN Browser
REM Run this script from the root of the LAIN project on Windows

echo LAIN Browser - Windows Build Script
echo ===================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    echo Please install Node.js (includes npm) from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js and npm are installed. Proceeding with build...

REM Install dependencies
echo Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

REM Build for Windows
echo Building LAIN for Windows...
npm run build:win
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo SUCCESS: LAIN has been built for Windows!
echo Check the 'release' folder for the installer.
echo.
pause