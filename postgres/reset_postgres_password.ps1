# Run this script from PowerShell opened with Run as Administrator.
param(
  [string]$ServiceName = 'postgresql-x64-18',
  [string]$PsqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe',
  [string]$HbaPath = 'C:\Program Files\PostgreSQL\18\data\pg_hba.conf'
)

$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Buka PowerShell dengan Run as Administrator lalu jalankan script ini.'
}
if (-not (Test-Path $PsqlPath)) { throw "psql.exe tidak ditemukan: $PsqlPath" }
if (-not (Test-Path $HbaPath)) { throw "pg_hba.conf tidak ditemukan: $HbaPath" }

$first = Read-Host 'Masukkan password baru role postgres' -AsSecureString
$second = Read-Host 'Ulangi password baru' -AsSecureString
$firstPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
$secondPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
try {
  $newPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPtr)
  $confirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPtr)
  if ([string]::IsNullOrWhiteSpace($newPassword) -or $newPassword -cne $confirmation) { throw 'Password kosong atau konfirmasi password tidak sama.' }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPtr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPtr)
}

$backupPath = "$HbaPath.backup_$(Get-Date -Format yyyyMMdd_HHmmss)"
Copy-Item $HbaPath $backupPath -Force
$original = Get-Content -Raw -Encoding UTF8 $HbaPath
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$temporary = $original -replace '(?m)^(local\s+all\s+all\s+)scram-sha-256\s*$', '$1trust' -replace '(?m)^(host\s+all\s+all\s+127\.0\.0\.1/32\s+)scram-sha-256\s*$', '$1trust' -replace '(?m)^(host\s+all\s+all\s+::1/128\s+)scram-sha-256\s*$', '$1trust'
if ($temporary -eq $original) { throw 'Baris autentikasi yang diharapkan tidak ditemukan; file tidak diubah.' }

try {
  [System.IO.File]::WriteAllText($HbaPath, $temporary, $utf8NoBom)
  Restart-Service $ServiceName -Force
  (Get-Service $ServiceName).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
  $env:PGPASSWORD = $newPassword
  $sql = "ALTER ROLE postgres PASSWORD '$($newPassword -replace "'", "''")';"
  $sql | & $PsqlPath --host=localhost --port=5432 --username=postgres --dbname=postgres --no-password --set=ON_ERROR_STOP=1 --file=-
  if ($LASTEXITCODE -ne 0) { throw "Gagal mengubah password PostgreSQL (exit code $LASTEXITCODE)." }
  Write-Host 'Password role postgres berhasil diubah.'
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  [System.IO.File]::WriteAllText($HbaPath, $original, $utf8NoBom)
  Restart-Service $ServiceName -Force
  (Get-Service $ServiceName).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
  Write-Host "Konfigurasi autentikasi dikembalikan ke scram-sha-256. Backup: $backupPath"
}
