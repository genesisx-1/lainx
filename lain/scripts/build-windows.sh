#!/bin/bash
# Windows Build Helper Script for LAIN

echo "LAIN Windows Build Helper"
echo "========================="

echo "Note: This script is for documentation purposes."
echo "Actual Windows builds must be performed on a Windows machine."
echo

echo "To build LAIN for Windows, you must:"
echo "1. Copy the source code to a Windows machine"
echo "2. Install Node.js and npm on the Windows machine"
echo "3. Run the following commands on Windows:"
echo
echo "   npm install"
echo "   npm run build:win"
echo
echo "This is required because LAIN uses native modules like node-pty"
echo "that must be compiled for the target platform."
echo

echo "Alternatively, you can use CI/CD platforms like GitHub Actions"
echo "with Windows runners to automate the build process."