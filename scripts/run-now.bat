@echo off
REM Manual trigger for the complete local flow (scrape -> tailor -> send), for running
REM on demand outside the 9:00 AM / 6:00 PM scheduled task - e.g. testing a change, or
REM wanting an extra run the same day. Double-click this file, or run it from a terminal
REM with "--dry-run" to pass through to run-all without sending real email.
cd /d "%~dp0.."
call npm run run-all -- %*
pause
