# Registers a single Windows Scheduled Task for the complete local flow
# (npm run run-all: scrape LinkedIn -> Posts sheet -> tailor + send for every pending
# row, all in one sequential process). Fires exactly twice a day, at 9:00 AM and 6:00 PM,
# for as long as the machine is on and you're logged in at those times.
#
# One task, not two: run-all does scrape then send in the same process, so there's no
# risk of two separately-scheduled steps racing to write the online Google Sheet at the
# same time.

$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c npm run run-all" -WorkingDirectory $projectDir

$currentUser = "$env:USERDOMAIN\$env:USERNAME"

# Two fixed daily times rather than a logon + repeat-every-N-hours trigger, so this always
# runs exactly twice a day regardless of how many times the machine is logged into.
$morningTrigger = New-ScheduledTaskTrigger -Daily -At "9:00AM"
$eveningTrigger = New-ScheduledTaskTrigger -Daily -At "6:00PM"

# ExecutionTimeLimit guards against a hung run (e.g. a LinkedIn checkpoint causing the
# scrape to stall, or a slow Gemini/Gmail call) blocking the next scheduled occurrence
# indefinitely.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 45)

Register-ScheduledTask -TaskName "SDETOutreachRunAll" -Action $action -Trigger @($morningTrigger, $eveningTrigger) -Settings $settings -User $currentUser -RunLevel Limited -Force

Write-Host "Registered scheduled task 'SDETOutreachRunAll': runs at 9:00 AM and 6:00 PM daily, from $projectDir"
Write-Host "Check status:  Get-ScheduledTask -TaskName SDETOutreachRunAll"
Write-Host "Run now:       Start-ScheduledTask -TaskName SDETOutreachRunAll"
Write-Host "Remove it:     Unregister-ScheduledTask -TaskName SDETOutreachRunAll -Confirm:`$false"
