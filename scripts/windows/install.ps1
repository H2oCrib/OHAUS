# Creates a ScaleSync shortcut on the user's Desktop that:
#   - runs scripts\windows\launch.vbs (which runs launch.bat hidden)
#   - uses scripts\windows\ScaleSync.ico
#
# Run once from PowerShell:
#   .\scripts\windows\install.ps1

$ErrorActionPreference = 'Stop'

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$target     = Join-Path $scriptDir 'launch.vbs'
$iconPath   = Join-Path $scriptDir 'ScaleSync.ico'
$desktop    = [Environment]::GetFolderPath('Desktop')
$shortcut   = Join-Path $desktop 'ScaleSync.lnk'

if (-not (Test-Path $target))   { throw "launch.vbs missing at $target" }
if (-not (Test-Path $iconPath)) { throw "ScaleSync.ico missing at $iconPath" }

$wsh = New-Object -ComObject WScript.Shell
$sc  = $wsh.CreateShortcut($shortcut)
$sc.TargetPath       = "$Env:SystemRoot\System32\wscript.exe"
$sc.Arguments        = "`"$target`""
$sc.WorkingDirectory = $scriptDir
$sc.IconLocation     = "$iconPath,0"
$sc.Description      = 'ScaleSync — cannabis scale weight verification'
$sc.WindowStyle      = 7  # Minimized (wscript is already hidden, this is belt-and-suspenders)
$sc.Save()

Write-Host "Desktop shortcut installed: $shortcut"
Write-Host "Double-click the ScaleSync icon to start the app."
