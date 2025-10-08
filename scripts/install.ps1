<#
  ChessVermouth Windows Bootstrap Installer (PowerShell)
  Usage: Right-click → Run with PowerShell (preferably as Administrator)
#>

Param()

Function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
Function Write-Ok($msg) { Write-Host "[ OK ] $msg" -ForegroundColor Green }
Function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
Function Write-Err($msg) { Write-Host "[ERR ] $msg" -ForegroundColor Red }

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Function Ensure-Admin {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warn "It is recommended to run this script as Administrator to install Node.js."
  }
}

Function Ensure-Node {
  Write-Info "Checking Node.js..."
  try {
    $v = (node -v) 2>$null
    if ($LASTEXITCODE -eq 0 -and $v) {
      $maj = [int]($v.TrimStart('v').Split('.')[0])
      if ($maj -ge 18) { Write-Ok "Node.js $v"; return }
      Write-Warn "Node.js $v found (<18). Upgrading..."
    } else {
      Write-Warn "Node.js not found. Installing..."
    }
  } catch { }

  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    Write-Info "Installing Node.js LTS via winget..."
    winget install -e --id OpenJS.NodeJS.LTS -h --accept-package-agreements --accept-source-agreements
  } else {
    Write-Info "winget not found. Attempting Chocolatey..."
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
      Write-Info "Installing Chocolatey..."
      Set-ExecutionPolicy Bypass -Scope Process -Force
      [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
      Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    }
    choco install nodejs-lts -y
  }
  Write-Ok "Node.js installed"
}

Function Run-Step($cmd, $cwd) {
  Write-Info "$cmd"
  if ($cwd) { Push-Location $cwd }
  try {
    & cmd /c $cmd
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $cmd" }
  } finally {
    if ($cwd) { Pop-Location }
  }
}

Ensure-Admin
Ensure-Node

Write-Info "Installing ChessVermouth dependencies..."
Run-Step "npm install" (Get-Location)
Run-Step "npm run build" (Get-Location)
Run-Step "node scripts\fetch-stockfish.mjs" (Get-Location)
Run-Step "npm install" (Join-Path (Get-Location) 'server')
Run-Step "npm install" (Join-Path (Get-Location) 'client')

Write-Ok "Setup complete. You can run: node chessvermouth.js"

