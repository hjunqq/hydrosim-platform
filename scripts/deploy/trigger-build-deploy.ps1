param(
  [string]$BaseUrl = "http://localhost:8000",
  [Parameter(Mandatory = $true)][string]$Username,
  [Parameter(Mandatory = $true)][string]$Password,
  [Parameter(Mandatory = $true)][string]$StudentCode,
  [string]$ProjectType,
  [string]$RepoUrl,
  [string]$Branch = "main",
  [string]$DockerfilePath = "Dockerfile",
  [string]$ContextPath = ".",
  [string]$ImageRepo,
  [switch]$GenerateDeployKey,
  [int]$PollSeconds = 5,
  [int]$TimeoutSeconds = 900
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

function Invoke-PortalRequest {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers,
    [object]$Body = $null
  )

  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 6
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json" -Body $json
  }
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers
}

Write-Host "Logging in..."
$loginBody = @{ username = $Username; password = $Password }
$login = Invoke-PortalRequest -Method Post -Uri "$BaseUrl/api/v1/auth/login/" -Headers @{} -Body $loginBody
if (-not $login.access_token) {
  throw "Login failed: access_token missing."
}

$headers = @{ Authorization = "Bearer $($login.access_token)" }

Write-Host "Resolving student..."
$projects = Invoke-PortalRequest -Method Get -Uri "$BaseUrl/api/v1/admin/projects/?search=$StudentCode" -Headers $headers
$student = $projects | Where-Object { $_.student_code -eq $StudentCode } | Select-Object -First 1
if (-not $student) {
  throw "Student not found: $StudentCode"
}

$studentId = $student.id
if (-not $ProjectType) {
  $ProjectType = $student.project_type
}

if ($RepoUrl) {
  Write-Host "Updating build config..."
  $configBody = @{
    repo_url = $RepoUrl
    branch = $Branch
    dockerfile_path = $DockerfilePath
    context_path = $ContextPath
  }
  if ($ImageRepo) {
    $configBody.image_repo = $ImageRepo
  }
  Invoke-PortalRequest -Method Put -Uri "$BaseUrl/api/v1/build-configs/$studentId" -Headers $headers -Body $configBody | Out-Null
}

if ($GenerateDeployKey) {
  Write-Host "Generating deploy key..."
  $key = Invoke-PortalRequest -Method Post -Uri "$BaseUrl/api/v1/build-configs/$studentId/deploy-key" -Headers $headers -Body @{ force = $false }
  if ($key.deploy_key_public) {
    Write-Host "Deploy key (add as Gitea Deploy Key):"
    Write-Host $key.deploy_key_public
  }
}

Write-Host "Triggering build..."
$triggerUri = "$BaseUrl/api/v1/builds/trigger?student_id=$studentId"
if ($Branch) {
  $triggerUri = "$triggerUri&branch=$Branch"
}
$build = Invoke-PortalRequest -Method Post -Uri $triggerUri -Headers $headers
if (-not $build.id) {
  throw "Build trigger failed."
}

$buildId = $build.id
Write-Host "Build started: $buildId"

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$current = $null
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds $PollSeconds
  $builds = Invoke-PortalRequest -Method Get -Uri "$BaseUrl/api/v1/builds/?student_id=$studentId&limit=50" -Headers $headers
  $current = $builds | Where-Object { $_.id -eq $buildId } | Select-Object -First 1
  if ($current -and $current.status -in @("success", "failed", "error", "cancelled")) {
    break
  }
  Write-Host "Build status: $($current.status)"
}

if (-not $current) {
  throw "Build status not found for ID $buildId."
}
if ($current.status -ne "success") {
  throw "Build did not succeed: $($current.status) - $($current.message)"
}

Write-Host "Deploying build..."
$deployBody = @{
  build_id = $buildId
  project_type = $ProjectType
}
$deploy = Invoke-PortalRequest -Method Post -Uri "$BaseUrl/api/v1/deploy/$StudentCode/build/" -Headers $headers -Body $deployBody

Write-Host "Deploy triggered: $($deploy.message)"
if ($deploy.url) {
  Write-Host "URL: $($deploy.url)"
}
