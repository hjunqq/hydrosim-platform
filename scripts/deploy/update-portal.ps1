param(
    [string]$Version,
    [ValidateSet("major", "minor", "patch")][string]$Bump = "patch",
    [string]$Registry,
    [string]$BackendDeployment = "deploy/backend/deployment.yaml",
    [string]$FrontendDeployment = "deploy/frontend/deployment.yaml",
    [string]$BackendDir = "backend",
    [string]$FrontendDir = "frontend",
    [switch]$SkipBuild,
    [switch]$SkipPush,
    [switch]$SyncDb,
    [string]$SourceDbUrl,
    [string]$SourceDbEnvFile = "backend/.env",
    [string]$PgDumpPath,
    [string]$DumpFile,
    [switch]$UseDockerDump,
    [string]$DockerDumpImage = "postgres:15-alpine",
    [string]$DockerHost = "host.docker.internal",
    [switch]$UpdateImages,
    [string]$TargetDbSecret = "portal-postgres-secret",
    [string]$TargetDbSelector = "app=portal-postgres",
    [string]$TargetDbUser,
    [string]$TargetDbPassword,
    [string]$TargetDbName,
    [switch]$CleanTarget,
    [switch]$SkipApply,
    [switch]$ApplyIngress,
    [string]$Namespace = "hydrosim",
    [switch]$WaitRollout,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    $root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    if (-not (Test-Path $root)) {
        throw "Repo root not found: $root"
    }
    return $root
}

function Get-ImageFromYaml {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        throw "Deployment file not found: $Path"
    }
    $content = Get-Content -Path $Path -Raw
    $match = [regex]::Match($content, '^\s*image:\s*(\S+)\s*$', [System.Text.RegularExpressions.RegexOptions]::Multiline)
    if (-not $match.Success) {
        throw "No image line found in: $Path"
    }
    return $match.Groups[1].Value
}

function Split-Image {
    param([string]$Image)
    if ($Image -match '^(.+):([^:/]+)$') {
        return [pscustomobject]@{
            Repo = $Matches[1]
            Tag  = $Matches[2]
        }
    }
    throw "Image tag missing or unsupported: $Image"
}

function Normalize-Version {
    param([string]$VersionValue)
    if ($VersionValue -match '^v(\d+\.\d+\.\d+)$') {
        return $Matches[1]
    }
    if ($VersionValue -match '^\d+\.\d+\.\d+$') {
        return $VersionValue
    }
    throw "Version must be semver (e.g. 1.2.3)."
}

function Bump-Version {
    param([string]$VersionValue, [string]$BumpType)
    if ($VersionValue -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
        throw "Current version is not semver: $VersionValue"
    }
    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    $patch = [int]$Matches[3]
    switch ($BumpType) {
        "major" { $major++; $minor = 0; $patch = 0 }
        "minor" { $minor++; $patch = 0 }
        "patch" { $patch++ }
    }
    return "$major.$minor.$patch"
}

function Override-Registry {
    param([string]$Repo, [string]$RegistryOverride)
    if (-not $RegistryOverride) {
        return $Repo
    }
    $parts = $Repo -split '/'
    if ($parts.Length -le 1) {
        return "$RegistryOverride/$Repo"
    }
    $path = ($parts[1..($parts.Length - 1)] -join '/')
    return "$RegistryOverride/$path"
}

function Update-ImageInYaml {
    param([string]$Path, [string]$NewImage)
    $content = Get-Content -Path $Path -Raw
    $regex = New-Object System.Text.RegularExpressions.Regex('(^\s*image:\s*)(\S+)', [System.Text.RegularExpressions.RegexOptions]::Multiline)
    $updated = $regex.Replace($content, "`$1$NewImage", 1)
    if ($updated -eq $content) {
        throw "No image update applied for $Path"
    }
    Set-Content -Path $Path -Value $updated -NoNewline
}

function Get-EnvValue {
    param([string]$Path, [string]$Key)
    if (-not (Test-Path $Path)) {
        return $null
    }
    $content = Get-Content -Path $Path -Raw
    $pattern = "(?m)^\s*$Key\s*=\s*(.+)\s*$"
    $match = [regex]::Match($content, $pattern)
    if (-not $match.Success) {
        return $null
    }
    $value = $match.Groups[1].Value.Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        return $value.Substring(1, $value.Length - 2)
    }
    return $value
}

function Get-SecretValue {
    param([string]$NamespaceValue, [string]$SecretName, [string]$Key)
    $encoded = kubectl -n $NamespaceValue get secret $SecretName -o jsonpath="{.data.$Key}"
    if (-not $encoded) {
        return $null
    }
    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
}

function Get-DockerDbUrl {
    param([string]$SourceUrl, [string]$DockerHostValue)
    try {
        $uri = [System.Uri]$SourceUrl
    } catch {
        return $SourceUrl
    }
    if ($uri.Host -in @("localhost", "127.0.0.1", "::1")) {
        $builder = New-Object System.UriBuilder $uri
        $builder.Host = $DockerHostValue
        return $builder.Uri.AbsoluteUri
    }
    return $SourceUrl
}

function Get-DbConnectionParts {
    param([string]$SourceUrl, [string]$DockerHostValue)
    $uri = $null
    if (-not [System.Uri]::TryCreate($SourceUrl, [System.UriKind]::Absolute, [ref]$uri)) {
        return $null
    }
    $dbHost = $uri.Host
    if ($dbHost -in @("localhost", "127.0.0.1", "::1")) {
        $dbHost = $DockerHostValue
    }
    $port = $uri.Port
    if (-not $port -or $port -le 0) {
        $port = 5432
    }
    $user = $null
    $password = $null
    if ($uri.UserInfo) {
        $parts = $uri.UserInfo.Split(":", 2)
        $user = [System.Uri]::UnescapeDataString($parts[0])
        if ($parts.Length -gt 1) {
            $password = [System.Uri]::UnescapeDataString($parts[1])
        }
    }
    $database = $uri.AbsolutePath.TrimStart("/")
    if (-not $database) {
        $database = $null
    }
    return [pscustomobject]@{
        Host = $dbHost
        Port = $port
        User = $user
        Password = $password
        Database = $database
    }
}

function New-TempDumpFile {
    $tempDir = [System.IO.Path]::GetTempPath()
    $fileName = "portal_dump_{0}.sql" -f ([System.Guid]::NewGuid().ToString("N"))
    return (Join-Path $tempDir $fileName)
}

$repoRoot = Get-RepoRoot
$backendDeploymentPath = Join-Path $repoRoot $BackendDeployment
$frontendDeploymentPath = Join-Path $repoRoot $FrontendDeployment
$backendDirPath = Join-Path $repoRoot $BackendDir
$frontendDirPath = Join-Path $repoRoot $FrontendDir
$sourceDbEnvPath = Join-Path $repoRoot $SourceDbEnvFile

$updateImages = $true
if ($SyncDb) {
    $updateImages = $PSBoundParameters.ContainsKey("UpdateImages") -or `
        $PSBoundParameters.ContainsKey("Version") -or `
        $PSBoundParameters.ContainsKey("Bump") -or `
        $PSBoundParameters.ContainsKey("Registry")
}

if ($DryRun) {
    Write-Host "Dry run: skipping updates and database sync."
    return
}

if (-not $updateImages -and $SyncDb) {
    Write-Host "SyncDb only: skipping image updates/build/push/apply. Use -UpdateImages to include version updates."
}

if ($updateImages) {
    $backendImage = Get-ImageFromYaml -Path $backendDeploymentPath
    $frontendImage = Get-ImageFromYaml -Path $frontendDeploymentPath

    $backendInfo = Split-Image -Image $backendImage
    $frontendInfo = Split-Image -Image $frontendImage

    if (-not $Version) {
        if ($backendInfo.Tag -ne $frontendInfo.Tag) {
            Write-Warning "Backend and frontend tags differ ($($backendInfo.Tag) vs $($frontendInfo.Tag)). Using backend tag."
        }
        $Version = Bump-Version -VersionValue $backendInfo.Tag -BumpType $Bump
    }
    $Version = Normalize-Version -VersionValue $Version

    $backendRepo = Override-Registry -Repo $backendInfo.Repo -RegistryOverride $Registry
    $frontendRepo = Override-Registry -Repo $frontendInfo.Repo -RegistryOverride $Registry

    $backendNewImage = "$backendRepo`:$Version"
    $frontendNewImage = "$frontendRepo`:$Version"

    Write-Host "Updating images to version $Version"
    Write-Host "Backend: $backendNewImage"
    Write-Host "Frontend: $frontendNewImage"

    Update-ImageInYaml -Path $backendDeploymentPath -NewImage $backendNewImage
    Update-ImageInYaml -Path $frontendDeploymentPath -NewImage $frontendNewImage

    if (-not $SkipBuild) {
        Write-Host "Building images..."
        docker build -t $backendNewImage $backendDirPath
        docker build -t $frontendNewImage $frontendDirPath
    }

    if (-not $SkipPush) {
        Write-Host "Pushing images..."
        docker push $backendNewImage
        docker push $frontendNewImage
    }
}

if ($SyncDb) {
    if (-not $SourceDbUrl) {
        $SourceDbUrl = Get-EnvValue -Path $sourceDbEnvPath -Key "DATABASE_URL"
    }
    if (-not $SourceDbUrl) {
        throw "Source DB URL missing. Provide -SourceDbUrl or set DATABASE_URL in $SourceDbEnvFile."
    }

    $podName = kubectl -n $Namespace get pod -l $TargetDbSelector -o jsonpath="{.items[0].metadata.name}"
    if (-not $podName) {
        throw "Target DB pod not found (selector: $TargetDbSelector in namespace $Namespace)."
    }

    if (-not $TargetDbUser) {
        $TargetDbUser = Get-SecretValue -NamespaceValue $Namespace -SecretName $TargetDbSecret -Key "POSTGRES_USER"
    }
    if (-not $TargetDbPassword) {
        $TargetDbPassword = Get-SecretValue -NamespaceValue $Namespace -SecretName $TargetDbSecret -Key "POSTGRES_PASSWORD"
    }
    if (-not $TargetDbName) {
        $TargetDbName = Get-SecretValue -NamespaceValue $Namespace -SecretName $TargetDbSecret -Key "POSTGRES_DB"
    }

    if (-not $TargetDbUser -or -not $TargetDbPassword -or -not $TargetDbName) {
        throw "Target DB credentials missing. Provide -TargetDbUser/-TargetDbPassword/-TargetDbName or ensure $TargetDbSecret exists."
    }

    Write-Host "Syncing database to $Namespace/$TargetDbSelector..."
    if ($CleanTarget) {
        Write-Host "Cleaning target schema (DROP SCHEMA public CASCADE)..."
        kubectl -n $Namespace exec -i $podName -- env "PGPASSWORD=$TargetDbPassword" psql -v ON_ERROR_STOP=1 -U $TargetDbUser -d $TargetDbName -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to clean target schema."
        }
    }
    $localDumpFile = $DumpFile
    $cleanupLocalDump = $false
    if (-not $localDumpFile) {
        $localDumpFile = New-TempDumpFile
        $cleanupLocalDump = $true
    }

    if (-not $DumpFile) {
        $dumpArgs = @("--no-owner", "--no-privileges", "--encoding=UTF8")
        if ($CleanTarget) {
            $dumpArgs += @("--clean", "--if-exists")
        }

        $pgDumpCommand = $null
        if (-not $UseDockerDump) {
            if ($PgDumpPath) {
                if (-not (Test-Path $PgDumpPath)) {
                    throw "pg_dump path not found: $PgDumpPath"
                }
                $pgDumpCommand = $PgDumpPath
            } else {
                $pgDumpCommand = (Get-Command "pg_dump" -ErrorAction SilentlyContinue).Source
            }
        }

        if ($pgDumpCommand) {
            $dumpArgs += @("--file", $localDumpFile, $SourceDbUrl)
            & $pgDumpCommand @dumpArgs
        } else {
            $dockerCmd = (Get-Command "docker" -ErrorAction SilentlyContinue).Source
            if (-not $dockerCmd) {
                throw "docker not found. Install Docker Desktop, or use -DumpFile, or provide -PgDumpPath."
            }
            $conn = Get-DbConnectionParts -SourceUrl $SourceDbUrl -DockerHostValue $DockerHost
            if (-not $conn -or -not $conn.Host -or -not $conn.User -or -not $conn.Database) {
                throw "SourceDbUrl must include user/host/database for Docker dump. Provide -SourceDbUrl like postgresql://user:pass@host:5432/db."
            }
            $dumpArgs += @("--file=/dump/{0}" -f (Split-Path -Leaf $localDumpFile))
            $dumpDir = (Resolve-Path -Path (Split-Path -Parent $localDumpFile)).Path
            $dockerArgs = @("run", "--rm", "-v", "${dumpDir}:/dump")
            if ($conn.Password) {
                $dockerArgs += @("-e", ("PGPASSWORD={0}" -f $conn.Password))
            }
            $dockerArgs += @($DockerDumpImage, "pg_dump", "-h", $conn.Host, "-p", $conn.Port, "-U", $conn.User, "-d", $conn.Database)
            $dockerArgs += $dumpArgs
            & $dockerCmd @dockerArgs
        }

        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $localDumpFile)) {
            throw "pg_dump failed to create dump file."
        }
    } elseif (-not (Test-Path $localDumpFile)) {
        throw "Dump file not found: $localDumpFile"
    }

    $remoteDumpPath = "/tmp/portal_dump.sql"
    $localDumpResolved = (Resolve-Path -Path $localDumpFile).Path
    $localDumpDir = Split-Path -Parent $localDumpResolved
    $localDumpName = Split-Path -Leaf $localDumpResolved
    Push-Location $localDumpDir
    try {
        kubectl -n $Namespace cp $localDumpName "${Namespace}/${podName}:$remoteDumpPath"
    } finally {
        Pop-Location
    }
    if ($LASTEXITCODE -ne 0) {
        throw "kubectl cp failed while uploading dump file."
    }
    kubectl -n $Namespace exec -i $podName -- env "PGPASSWORD=$TargetDbPassword" "PGCLIENTENCODING=UTF8" psql -v ON_ERROR_STOP=1 -U $TargetDbUser -d $TargetDbName -f $remoteDumpPath
    kubectl -n $Namespace exec -i $podName -- rm -f $remoteDumpPath | Out-Null

    if ($cleanupLocalDump) {
        Remove-Item -Path $localDumpFile -Force -ErrorAction SilentlyContinue
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Database sync failed."
    }
}

if ($updateImages -and -not $SkipApply) {
    Write-Host "Applying manifests..."
    kubectl apply -f (Join-Path $repoRoot "deploy/backend/")
    kubectl apply -f (Join-Path $repoRoot "deploy/frontend/")
    if ($ApplyIngress) {
        kubectl apply -f (Join-Path $repoRoot "deploy/ingress/")
    }
}

if ($updateImages -and $WaitRollout -and -not $SkipApply) {
    Write-Host "Waiting for rollout..."
    kubectl -n $Namespace rollout status deploy/portal-backend
    kubectl -n $Namespace rollout status deploy/portal-frontend
}
