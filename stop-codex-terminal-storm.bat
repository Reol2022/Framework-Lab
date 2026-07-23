@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "THRESHOLD=30"

echo [Codex emergency cleanup] Checking terminal process count...

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'SilentlyContinue';" ^
  "$threshold = %THRESHOLD%;" ^
  "$conhosts = @(Get-Process -Name conhost -ErrorAction SilentlyContinue);" ^
  "$count = $conhosts.Count;" ^
  "Write-Host ('Current conhost.exe count: ' + $count);" ^
  "if ($count -lt $threshold) {" ^
  "  Write-Host ('Count is below safety threshold ' + $threshold + '; nothing was stopped.');" ^
  "  exit 2;" ^
  "}" ^
  "Write-Host 'Terminal storm detected. Stopping Codex command runners...';" ^
  "$runners = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like 'codex-command-runner*' });" ^
  "$runners | Stop-Process -Force -ErrorAction SilentlyContinue;" ^
  "Write-Host ('Stopped command runners: ' + $runners.Count);" ^
  "$monitors = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'powershell.exe' -and ($_.CommandLine -like '*Win32_PerfFormattedData_PerfProc_Process*' -or ($_.CommandLine -like '*Get-CimInstance Win32_Process*' -and $_.CommandLine -like '*CpuPercent*')) });" ^
  "$monitorIds = @($monitors | Select-Object -ExpandProperty ProcessId);" ^
  "if ($monitorIds.Count -gt 0) { Stop-Process -Id $monitorIds -Force -ErrorAction SilentlyContinue };" ^
  "Write-Host ('Stopped runaway process monitors: ' + $monitorIds.Count);" ^
  "$before = @(Get-Process -Name conhost -ErrorAction SilentlyContinue).Count;" ^
  "Get-Process -Name conhost -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue;" ^
  "Start-Sleep -Milliseconds 800;" ^
  "$after = @(Get-Process -Name conhost -ErrorAction SilentlyContinue).Count;" ^
  "Write-Host ('Stopped conhost processes: ' + $before);" ^
  "Write-Host ('Remaining conhost processes: ' + $after);" ^
  "if ($after -ge $threshold) {" ^
  "  Write-Host 'WARNING: Processes are still being regenerated. Stop other active Codex tasks and restart Codex.' -ForegroundColor Red;" ^
  "  exit 1;" ^
  "}" ^
  "Write-Host 'Cleanup completed.' -ForegroundColor Green;" ^
  "exit 0;"

set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="2" echo Safety check prevented cleanup because no terminal storm was detected.
if "%RESULT%"=="1" echo Cleanup could not stop the generator. Close other active Codex tasks, then restart Codex.
if "%RESULT%"=="0" echo The runaway terminal processes were cleaned up.
echo.
pause
exit /b %RESULT%
