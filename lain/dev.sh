#!/bin/bash

# Start Vite dev server in background
npm run dev:vite &
VITE_PID=$!

# Wait for Vite to start
sleep 3

# Start Electron
NODE_ENV=development npx electron .

# Clean up on exit
trap "kill $VITE_PID" EXIT
