param(
    [string]$BackupPath,
    [string]$BackupDir = ".\prod-db-backups",
    [string]$LocalUri = $env:LOCAL_DB_URI,
    [string]$SourceDb = "nexgen",
    [string]$TargetDb = "nexgen_local"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($LocalUri)) {
    $LocalUri = "mongodb://127.0.0.1:27017"
}

if ($LocalUri -notmatch "^mongodb://(127\.0\.0\.1|localhost)(:\d+)?/?$") {
    throw "Refusing to restore into a non-local MongoDB URI. LocalUri must look like mongodb://127.0.0.1:27017 or mongodb://localhost:27017."
}

if ([string]::IsNullOrWhiteSpace($BackupPath)) {
    if (-not (Test-Path $BackupDir)) {
        throw "BackupDir does not exist: $BackupDir"
    }

    $latestBackup = Get-ChildItem -Path $BackupDir -Filter "*.archive.gz" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $latestBackup) {
        throw "No .archive.gz backup files were found in $BackupDir."
    }

    $BackupPath = $latestBackup.FullName
}

if (-not (Test-Path $BackupPath)) {
    throw "Backup file does not exist: $BackupPath"
}

function Resolve-MongoCommand($Name, $SearchRoots) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    foreach ($root in $SearchRoots) {
        if (Test-Path $root) {
            $exe = Get-ChildItem -Path $root -Recurse -Filter "$Name.exe" -ErrorAction SilentlyContinue |
                Select-Object -First 1

            if ($exe) {
                return $exe.FullName
            }
        }
    }

    throw "Missing '$Name'. Install MongoDB Server/Database Tools, reopen PowerShell, then try again."
}

$mongoRestore = Resolve-MongoCommand "mongorestore" @("C:\Program Files\MongoDB\Tools")

Write-Host "Restoring backup into local database '$TargetDb'..."
Write-Host "Backup file: $BackupPath"

& $mongoRestore `
    --uri="$LocalUri" `
    --archive="$BackupPath" `
    --gzip `
    --nsFrom="$SourceDb.*" `
    --nsTo="$TargetDb.*" `
    --drop

if ($LASTEXITCODE -ne 0) {
    throw "mongorestore failed."
}

Write-Host "Done. Backup restored locally."
Write-Host "Use DB_URI=mongodb://127.0.0.1:27017/$TargetDb when running the backend locally."
