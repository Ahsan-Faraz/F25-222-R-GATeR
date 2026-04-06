# Clear Workspace for Fresh Analysis
# This script clears all databases and caches to prepare for a fresh repository analysis

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "CLEARING WORKSPACE FOR FRESH ANALYSIS" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan

# 1. Clear LanceDB
Write-Host "`n[1/5] Clearing LanceDB..." -ForegroundColor Yellow
if (Test-Path "workspace/lancedb") {
    Remove-Item -Recurse -Force workspace/lancedb
    Write-Host "  [OK] LanceDB cleared" -ForegroundColor Green
} else {
    Write-Host "  [OK] LanceDB already empty" -ForegroundColor Green
}

# 2. Clear Kuzu Knowledge Graph
Write-Host "`n[2/5] Clearing Kuzu Knowledge Graph..." -ForegroundColor Yellow
if (Test-Path "workspace/gater_knowledge_graph") {
    Remove-Item -Recurse -Force workspace/gater_knowledge_graph
    Write-Host "  [OK] Kuzu database cleared" -ForegroundColor Green
} else {
    Write-Host "  [OK] Kuzu database already empty" -ForegroundColor Green
}

# 3. Clear cached entity files
Write-Host "`n[3/5] Clearing cached entity files..." -ForegroundColor Yellow
$filesCleared = 0
if (Test-Path "workspace/data/entities.jsonl") {
    Remove-Item workspace/data/entities.jsonl
    $filesCleared++
}
if (Test-Path "workspace/data/knowledge_graph.jsonl") {
    Remove-Item workspace/data/knowledge_graph.jsonl
    $filesCleared++
}
Write-Host "  [OK] Cleared $filesCleared cached files" -ForegroundColor Green

# 4. Clear embedding cache (optional - keeps embeddings for faster re-analysis)
Write-Host "`n[4/5] Clearing embedding cache..." -ForegroundColor Yellow
$response = Read-Host "  Clear embedding cache? This will make re-analysis slower but ensures fresh embeddings (y/N)"
if ($response -eq 'y' -or $response -eq 'Y') {
    if (Test-Path "workspace/embeddings_cache") {
        Remove-Item -Recurse -Force workspace/embeddings_cache/*
        Write-Host "  [OK] Embedding cache cleared" -ForegroundColor Green
    }
} else {
    Write-Host "  [SKIP] Keeping embedding cache" -ForegroundColor Yellow
}

# 5. Check if Flask server is running
Write-Host "`n[5/5] Checking Flask server..." -ForegroundColor Yellow
$flaskProcess = Get-Process python -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*web_server.py*"
}

if ($flaskProcess) {
    Write-Host "  [WARNING] Flask server is running with old data in memory" -ForegroundColor Red
    Write-Host "  You MUST restart the Flask server for changes to take effect!" -ForegroundColor Red
    Write-Host ""
    $restart = Read-Host "  Restart Flask server now? (y/N)"
    if ($restart -eq 'y' -or $restart -eq 'Y') {
        Write-Host "  Stopping Flask server..." -ForegroundColor Yellow
        $flaskProcess | Stop-Process -Force
        Start-Sleep -Seconds 2
        Write-Host "  Starting Flask server..." -ForegroundColor Yellow
        Start-Process python -ArgumentList "web_server.py" -NoNewWindow
        Write-Host "  [OK] Flask server restarted" -ForegroundColor Green
    } else {
        Write-Host "  [ACTION REQUIRED] Please restart Flask server manually:" -ForegroundColor Red
        Write-Host "    1. Stop the current server (Ctrl+C in the terminal)" -ForegroundColor Yellow
        Write-Host "    2. Run: python web_server.py" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [OK] No Flask server running" -ForegroundColor Green
    Write-Host "  Start server with: python web_server.py" -ForegroundColor Cyan
}

Write-Host "`n" -NoNewline
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "WORKSPACE CLEARED - READY FOR FRESH ANALYSIS" -ForegroundColor Green
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Ensure Flask server is restarted (if it was running)" -ForegroundColor White
Write-Host "  2. Go to frontend and click 'Start new analysis'" -ForegroundColor White
Write-Host "  3. The analysis will now extract code snippets automatically" -ForegroundColor White
Write-Host ""
