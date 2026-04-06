# Restart Flask Server Script
# This script stops any running Flask server and starts a new one

Write-Host "Stopping Flask server..." -ForegroundColor Yellow

# Find and kill any Python process running web_server.py
Get-Process python -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*web_server.py*"
} | Stop-Process -Force

Start-Sleep -Seconds 2

Write-Host "Starting Flask server..." -ForegroundColor Green
Start-Process python -ArgumentList "web_server.py" -NoNewWindow

Write-Host "Flask server restarted!" -ForegroundColor Green
Write-Host "Server should be available at http://localhost:5000" -ForegroundColor Cyan
