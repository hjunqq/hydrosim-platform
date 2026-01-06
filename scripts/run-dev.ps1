param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173,
    [string]$BackendHost = "0.0.0.0",
    [string]$FrontendHost = "0.0.0.0"
)

$ErrorActionPreference = "Stop"

function Test-WinExecutable {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        return $false
    }
    try {
        $bytes = Get-Content -Path $Path -Encoding Byte -TotalCount 2
        return ($bytes.Length -ge 2 -and $bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A)
    } catch {
        return $false
    }
}

function Start-DevProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory
    )
    try {
        Write-Host "Starting $Name..."
        return Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDirectory -NoNewWindow -PassThru
    } catch {
        $argsString = ($ArgumentList -join " ")
        throw "$Name failed to start. FilePath: $FilePath Args: $argsString Error: $($_.Exception.Message)"
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"

if (-not (Test-Path $backendDir)) {
    throw "Backend directory not found: $backendDir"
}

if (-not (Test-Path $frontendDir)) {
    throw "Frontend directory not found: $frontendDir"
}

$venvPython = Join-Path $backendDir ".venv\\Scripts\\python.exe"
$pythonPath = $null
$pythonPrefix = @()
if (Test-WinExecutable $venvPython) {
    $pythonPath = $venvPython
} else {
    if (Get-Command "py" -ErrorAction SilentlyContinue) {
        $pythonPath = "py"
        $pythonPrefix = @("-3")
    } elseif (Get-Command "python" -ErrorAction SilentlyContinue) {
        $pythonPath = "python"
    } else {
        throw "python not found in PATH and backend .venv is missing or invalid."
    }
}

$pnpmCmdInfo = Get-Command "pnpm" -ErrorAction SilentlyContinue
if (-not $pnpmCmdInfo) {
    throw "pnpm not found in PATH."
}

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Warning "frontend\\node_modules not found. Run: cd frontend; pnpm install"
}

if (-not (Test-Path (Join-Path $backendDir ".env"))) {
    Write-Warning "backend\\.env not found. Copy backend\\.env.example and set DATABASE_URL."
}

$backendArgs = @(
    "-m",
    "uvicorn",
    "app.main:app",
    "--reload",
    "--host",
    $BackendHost,
    "--port",
    $BackendPort
)
$backendArgs = $pythonPrefix + $backendArgs

$frontendArgs = @(
    "dev",
    "--",
    "--host",
    $FrontendHost,
    "--port",
    $FrontendPort
)

$pnpmFilePath = $pnpmCmdInfo.Source
$pnpmArgs = $frontendArgs

if ($pnpmCmdInfo.CommandType -eq "ExternalScript") {
    $ext = [IO.Path]::GetExtension($pnpmFilePath).ToLowerInvariant()
    if ($ext -eq ".ps1") {
        $pnpmCmdPath = Join-Path (Split-Path $pnpmFilePath) "pnpm.cmd"
        if (Test-Path $pnpmCmdPath) {
            $pnpmFilePath = $pnpmCmdPath
        } else {
            $pnpmFilePath = "powershell"
            $pnpmArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $pnpmCmdInfo.Source) + $frontendArgs
        }
    }
} elseif ($pnpmCmdInfo.CommandType -ne "Application") {
    $pnpmFilePath = "cmd.exe"
    $pnpmArgs = @("/c", "pnpm") + $frontendArgs
}

$backend = Start-DevProcess -Name "backend (uvicorn) on $BackendHost`:$BackendPort" -FilePath $pythonPath -ArgumentList $backendArgs -WorkingDirectory $backendDir
try {
    Write-Host "Using pnpm runner: $pnpmFilePath"
    $frontend = Start-DevProcess -Name "frontend (vite) on $FrontendHost`:$FrontendPort" -FilePath $pnpmFilePath -ArgumentList $pnpmArgs -WorkingDirectory $frontendDir
} catch {
    if ($backend -and -not $backend.HasExited) {
        Stop-Process -Id $backend.Id -Force
    }
    throw
}

$procs = @($backend, $frontend)

try {
    Write-Host "Backend PID: $($backend.Id)  Frontend PID: $($frontend.Id)"
    Write-Host "Press Ctrl+C to stop."
    $firstExit = Wait-Process -Id @($backend.Id, $frontend.Id) -Any
    Write-Warning "Process $($firstExit.Id) exited. Stopping the other process."
} catch {
    Write-Warning "Stopping processes..."
} finally {
    foreach ($p in $procs) {
        if ($p -and -not $p.HasExited) {
            Stop-Process -Id $p.Id -Force
        }
    }
}
