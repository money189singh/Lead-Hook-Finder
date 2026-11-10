#!/usr/bin/env bash
set -e

echo "========================================================="
echo "Building LeadHook Windows Package"
echo "========================================================="

echo "[1/3] Building web bundle & backend..."
npm run build

echo "[2/3] Checking Electron..."
npx electron-builder --win --x64

echo "========================================================="
echo "Build complete! Artifacts are in dist_installer/"
echo "========================================================="
