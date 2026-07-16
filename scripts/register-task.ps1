# Registers a single Windows Scheduled Task for the complete local flow
# (npm run run-all: scrape LinkedIn -> Posts sheet -> tailor + send for every pending
# row, all in one sequential process). Runs once at logon (i.e. when you start/log into
# this laptop), then repeats every 2 hours after that for as long as the machine stays
# on and you stay logged in.
#
# One task, not two: run-all does scrape then send in the same process, so there's no
# risk of two separately-scheduled steps opening data/tracker.xlsx at the same time.

$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c npm run run-all" -WorkingDirectory $projectDir

$currentUser = "$env:USERDOMAIN\$env:USERNAME"

# -AtLogOn needs an explicit -User (both on the trigger and on Register-ScheduledTask
# below) - registering it without one fails with "Access is denied" even for a task
# scoped to the current user's own limited privileges.
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
# -AtLogOn has no repetition parameters of its own; borrow the Repetition CIM instance
# from a throwaway time-based trigger and attach it to the logon trigger.
# [TimeSpan]::MaxValue exceeds Task Scheduler's valid duration range - use a large but
# in-range duration instead (10 years is effectively "indefinitely" for this purpose).
$repeatingTemplate = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Days 3650)
$trigger.Repetition = $repeatingTemplate.Repetition

# ExecutionTimeLimit guards against a hung run (e.g. a LinkedIn checkpoint causing the
# scrape to stall, or a slow Gemini/Gmail call) blocking the next scheduled occurrence
# indefinitely.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 45)

Register-ScheduledTask -TaskName "SDETOutreachRunAll" -Action $action -Trigger $trigger -Settings $settings -User $currentUser -RunLevel Limited -Force

Write-Host "Registered scheduled task 'SDETOutreachRunAll': runs at logon, then every 2 hours, from $projectDir"
Write-Host "Check status:  Get-ScheduledTask -TaskName SDETOutreachRunAll"
Write-Host "Run now:       Start-ScheduledTask -TaskName SDETOutreachRunAll"
Write-Host "Remove it:     Unregister-ScheduledTask -TaskName SDETOutreachRunAll -Confirm:`$false"
