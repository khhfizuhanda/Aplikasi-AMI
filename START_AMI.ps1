$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.env')) -and -not $env:PGPASSWORD) {
    $amiSecurePassword = Read-Host 'Password PostgreSQL (role postgres)' -AsSecureString
    $amiPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($amiSecurePassword)
    try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($amiPasswordPointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($amiPasswordPointer) }
}
try { node server.js }
finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
