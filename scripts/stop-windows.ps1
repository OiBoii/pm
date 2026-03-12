$ErrorActionPreference = "Stop"

$ContainerName = "pm-mvp-app"
$existing = docker ps -a --filter "name=^$ContainerName$" --format "{{.Names}}"

if ($existing -eq $ContainerName) {
    docker rm -f $ContainerName | Out-Null
    Write-Host "Stopped and removed container: $ContainerName"
} else {
    Write-Host "No container found named $ContainerName"
}
