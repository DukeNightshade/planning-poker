# Baut das Deploy-Paket fuer den Server:
# Docker-Image bauen -> als .tar exportieren -> zusammen mit
# docker-compose.yml, .env.example und ANLEITUNG.txt in ein Zip packen.
#
# Voraussetzung: laufende Docker-Engine (Docker Desktop o.ae.)
# Aufruf aus dem Projektverzeichnis:  pwsh deploy/build-package.ps1

param(
    [string]$Version = "1.1.0"
)

$ErrorActionPreference = "Stop"

$root    = Split-Path -Parent $PSScriptRoot
$stage   = Join-Path $PSScriptRoot "planning-poker-server-deploy"
$tar     = Join-Path $stage "planning-poker-$Version.tar"
$zip     = Join-Path $PSScriptRoot "Planning-Poker-Docker-Image-$Version.zip"
$image   = "planning-poker:$Version"

Push-Location $root
try {
    docker version --format '{{.Server.Version}}' | Out-Null

    Write-Host "[1/4] Image bauen: $image"
    docker build -t $image .
    if ($LASTEXITCODE -ne 0) { throw "docker build fehlgeschlagen" }

    Write-Host "[2/4] Image exportieren: $tar"
    Get-ChildItem $stage -Filter "planning-poker-*.tar" | Remove-Item -Force
    docker save -o $tar $image
    if ($LASTEXITCODE -ne 0) { throw "docker save fehlgeschlagen" }

    Write-Host "[3/4] Paket pruefen"
    foreach ($f in @("docker-compose.yml", ".env.example", "ANLEITUNG.txt")) {
        if (-not (Test-Path (Join-Path $stage $f))) { throw "fehlt im Paket: $f" }
    }

    Write-Host "[4/4] Zip erstellen: $zip"
    if (Test-Path $zip) { Remove-Item $zip -Force }
    Compress-Archive -Path $stage -DestinationPath $zip -CompressionLevel Optimal

    $mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
    Write-Host "Fertig: $zip ($mb MB)"
}
finally {
    Pop-Location
}
