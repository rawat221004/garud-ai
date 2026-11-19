# GARUD AI dev starter: backend (8000) + frontend (5173) in two windows.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\dev.ps1

$root = Split-Path -Parent $PSScriptRoot

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "cd '$root\backend'; .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

Start-Sleep -Seconds 2

# Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "cd '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "GARUD AI starting:" -ForegroundColor Cyan
Write-Host "  Dashboard : http://localhost:5173" -ForegroundColor Green
Write-Host "  API docs  : http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "Tip: run scripts\smoke_test.ps1 to verify all 19 acceptance checks before a demo."
