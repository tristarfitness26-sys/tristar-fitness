# Starts the Tri Star Fitness backend server with safe working directory and simple logging
$ErrorActionPreference = 'Stop'

$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendDir

# Ensure logs directory exists
$logDir = Join-Path $backendDir 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

# Start server and tee output
$timestamp = (Get-Date).ToString('yyyy-MM-dd_HH-mm-ss')
$logFile = Join-Path $logDir "backend_$timestamp.log"

# If node is not on PATH, try common install path
$nodeExe = 'node'
if (-not (Get-Command $nodeExe -ErrorAction SilentlyContinue)) {
  $maybeNode = 'C:\\Program Files\\nodejs\\node.exe'
  if (Test-Path $maybeNode) { $nodeExe = '"' + $maybeNode + '"' }
}

$cmd = "$nodeExe server.js"
cmd /c $cmd 2>&1 | Tee-Object -FilePath $logFile
