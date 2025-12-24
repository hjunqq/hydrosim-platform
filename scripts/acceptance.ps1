param(
  [string]$BaseUrl = "http://localhost:8000",
  [string]$AdminUser = $env:PORTAL_ADMIN_USER,
  [string]$AdminPassword = $env:PORTAL_ADMIN_PASSWORD
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

Write-Host "Checking health..."
$health = Invoke-RestMethod -Uri "$BaseUrl/health"
if ($health.status -ne "healthy") {
  throw "Health check failed"
}
Write-Host "Health check ok."

if ($AdminUser -and $AdminPassword) {
  Write-Host "Checking login..."
  $loginBody = @{ username = $AdminUser; password = $AdminPassword } | ConvertTo-Json
  $loginResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/login" -ContentType "application/json" -Body $loginBody
  if (-not $loginResponse.access_token) {
    throw "Login response missing access_token"
  }
  Write-Host "Login ok."
} else {
  Write-Host "Skipping login check (PORTAL_ADMIN_USER/PASSWORD not set)."
}

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$studentCode = "s$stamp"

Write-Host "Creating student..."
$studentBody = @{
  student_code = $studentCode
  name = "Student $stamp"
  project_type = "gd"
  git_repo_url = "https://example.com/repo.git"
  domain = "$studentCode.hydrosim.local"
} | ConvertTo-Json

$student = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/students" -ContentType "application/json" -Body $studentBody
if (-not $student.id) {
  throw "Student create failed"
}
Write-Host "Student created: $($student.id)"

Write-Host "Updating student..."
$studentUpdate = @{ name = "Student $stamp Updated" } | ConvertTo-Json
$student = Invoke-RestMethod -Method Put -Uri "$BaseUrl/api/v1/students/$($student.id)" -ContentType "application/json" -Body $studentUpdate

Write-Host "Listing students..."
$students = Invoke-RestMethod -Uri "$BaseUrl/api/v1/students?skip=0&limit=5"
if (-not $students) {
  throw "Student list failed"
}

Write-Host "Creating deployment..."
$deploymentBody = @{ student_id = $student.id; image_tag = "example/image:latest" } | ConvertTo-Json
$deployment = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/deployments" -ContentType "application/json" -Body $deploymentBody
if (-not $deployment.id) {
  throw "Deployment create failed"
}
Write-Host "Deployment created: $($deployment.id)"

Write-Host "Updating deployment..."
$deploymentUpdate = @{
  status = "running"
  message = "Acceptance test"
  last_deploy_time = (Get-Date).ToString("o")
} | ConvertTo-Json
$deployment = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/api/v1/deployments/$($deployment.id)" -ContentType "application/json" -Body $deploymentUpdate

Write-Host "Deleting deployment..."
Invoke-RestMethod -Method Delete -Uri "$BaseUrl/api/v1/deployments/$($deployment.id)"

Write-Host "Deleting student..."
Invoke-RestMethod -Method Delete -Uri "$BaseUrl/api/v1/students/$($student.id)"

Write-Host "Acceptance checks passed."
