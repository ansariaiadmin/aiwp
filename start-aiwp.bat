@echo off
rem AiWp — Windows double-click launcher.
rem Runs the PowerShell installer without requiring the user to change the
rem execution policy by hand. All real logic lives in start-aiwp.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-aiwp.ps1"
pause
