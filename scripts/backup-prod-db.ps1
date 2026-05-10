param(
    [string]$ProdUri = $env:PROD_DB_URI,
    [string]$BackupDir = ".\prod-db-backups",
    [string]$DatabaseName = "nexgen"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProdUri)) {
    throw "Missing production MongoDB URI. Pass -ProdUri or set the PROD_DB_URI environment variable."
}

if ($ProdUri -notmatch "^mongodb(\+srv)?://") {
    throw "Invalid production MongoDB URI. It must start with mongodb:// or mongodb+srv://."
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

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $BackupDir "$DatabaseName-prod-$timestamp.archive.gz"
$metaPath = "$backupPath.txt"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Write-Host "Creating production backup..."
Write-Host "Backup file: $backupPath"

& $mongoDump --uri="$ProdUri" --archive="$backupPath" --gzip
if ($LASTEXITCODE -ne 0) {
    throw "mongodump failed. No production backup was created."
}

$backupFile = Get-Item $backupPath
$hash = Get-FileHash -Path $backupPath -Algorithm SHA256

@"
Database: $DatabaseName
CreatedAt: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")
BackupFile: $backupPath
SizeBytes: $($backupFile.Length)
SHA256: $($hash.Hash)
"@ | Set-Content -Path $metaPath -Encoding UTF8

Write-Host "Done. Production backup created successfully."
Write-Host "Archive: $backupPath"
Write-Host "Metadata: $metaPath"
