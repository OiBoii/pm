$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$ImageName = "pm-mvp-app:latest"
$ContainerName = "pm-mvp-app"

Write-Host "Building Docker image: $ImageName"
docker build -t $ImageName $ProjectRoot | Out-Host

$existing = docker ps -a --filter "name=^$ContainerName$" --format "{{.Names}}"
if ($existing -eq $ContainerName) {
    Write-Host "Removing existing container: $ContainerName"
    docker rm -f $ContainerName | Out-Null
}

Write-Host "Starting container: $ContainerName"
$EnvFile = Join-Path $ProjectRoot ".env"
if (Test-Path $EnvFile) {
    docker run -d --name $ContainerName --env-file $EnvFile -p 8000:8000 $ImageName | Out-Null
} else {
    docker run -d --name $ContainerName -p 8000:8000 $ImageName | Out-Null
}

Write-Host "App started:"
Write-Host "  http://127.0.0.1:8000/"
Write-Host "  http://127.0.0.1:8000/api/hello"
