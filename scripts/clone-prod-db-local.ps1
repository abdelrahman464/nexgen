param(
    [string]$ProdUri = $env:PROD_DB_URI,
    [string]$LocalUri = $env:LOCAL_DB_URI,
    [string]$SourceDb = "nexgen",
    [string]$TargetDb = "nexgen_local",
    [string]$BackupDir = ".\db-backups",
    [switch]$DropLocal
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProdUri)) {
    throw "Missing production MongoDB URI. Pass -ProdUri or set the PROD_DB_URI environment variable."
}

if ([string]::IsNullOrWhiteSpace($LocalUri)) {
    $LocalUri = "mongodb://127.0.0.1:27017"
}

if ($LocalUri -notmatch "^(mongodb(\+srv)?://)?(127\.0\.0\.1|localhost)(:|/|$)") {
    throw "Refusing to restore into a non-local MongoDB URI. LocalUri must use localhost or 127.0.0.1."
}

function Resolve-MongoCommand($Name, $SearchRoot) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    if (Test-Path $SearchRoot) {
        $exe = Get-ChildItem -Path $SearchRoot -Recurse -Filter "$Name.exe" -ErrorAction SilentlyContinue |
            Select-Object -First 1

        if ($exe) {
            return $exe.FullName
        }
    }

    throw "Missing '$Name'. Install MongoDB Database Tools, reopen PowerShell, then try again."
}

$mongoDump = Resolve-MongoCommand "mongodump" "C:\Program Files\MongoDB\Tools"
$mongoRestore = Resolve-MongoCommand "mongorestore" "C:\Program Files\MongoDB\Tools"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $BackupDir "nexgen-prod-$timestamp.archive.gz"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Write-Host "Dumping production database..."
& $mongoDump --uri="$ProdUri" --archive="$backupPath" --gzip
if ($LASTEXITCODE -ne 0) {
    throw "mongodump failed. No local restore was attempted."
}

Write-Host "Restoring production database '$SourceDb' into local database '$TargetDb' on $LocalUri"
$restoreArgs = @(
    "--uri=$LocalUri",
    "--archive=$backupPath",
    "--gzip",
    "--nsFrom=$SourceDb.*",
    "--nsTo=$TargetDb.*"
)
if ($DropLocal) {
    $restoreArgs += "--drop"
}

& $mongoRestore @restoreArgs
if ($LASTEXITCODE -ne 0) {
    throw "mongorestore failed."
}

Write-Host "Done. Your local MongoDB copy is ready."
Write-Host "Use DB_URI=mongodb://127.0.0.1:27017/$TargetDb when running the backend locally."
