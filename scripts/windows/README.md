# ScaleSync — Windows Launcher

One-click desktop launcher for Windows. Double-click the installed shortcut → dev server starts in the background (hidden) → Edge or Chrome opens full-screen on `http://localhost:5173`.

## Install (once)

From a PowerShell prompt at the repo root:

```powershell
.\scripts\windows\install.ps1
```

This creates `ScaleSync.lnk` on your Desktop with the brandmark icon. If PowerShell blocks the script, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install.ps1
```

## Prereqs

- **Node.js** (the launcher runs `npm run dev`). Install from nodejs.org or via winget: `winget install OpenJS.NodeJS`.
- **One time:** `cd <repo> && npm install` — the launcher assumes dependencies are already installed.
- **`.env.local`** in the repo root if you want cloud sync. Copy from `.env.example` and fill in Supabase keys.

## What the pieces do

- `launch.bat` — checks port 5173; starts `npm run dev` in a hidden window if nothing is serving; waits up to 45 s for the server; opens Edge / Chrome in `--app=` mode (no browser chrome). Falls back to the default browser.
- `launch.vbs` — silent wrapper so a double-click doesn't flash a console window.
- `install.ps1` — puts a `ScaleSync.lnk` shortcut on the Desktop pointing at `launch.vbs` with the brandmark `.ico`.
- `ScaleSync.ico` — multi-size Windows icon (16/32/48/64/128/256) rendered from `scripts/scalesync-mark.svg`.

## Logs

Server output is written to `%LOCALAPPDATA%\ScaleSync\dev-server.log`.

## Uninstall

Delete `ScaleSync.lnk` from your Desktop. Everything else lives inside the repo.
