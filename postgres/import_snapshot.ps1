param(
  [Parameter(Mandatory=$true)] [string]$SnapshotPath,
  [string]$Database = 'ami_local',
  [string]$HostName = 'localhost',
  [int]$Port = 5432,
  [string]$User = 'postgres',
  [string]$PsqlPath = ''
)

$ErrorActionPreference = 'Stop'
$schemaPath = Join-Path $PSScriptRoot 'schema.sql'
$snapshot = Get-Content -Raw -Encoding UTF8 $SnapshotPath | ConvertFrom-Json

if (-not $PsqlPath) {
  $psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
  if ($psqlCommand) { $PsqlPath = $psqlCommand.Source }
  else {
    $candidate = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
    if ($candidate) { $PsqlPath = $candidate.FullName }
  }
}
if (-not $PsqlPath -or -not (Test-Path $PsqlPath)) {
  throw 'psql.exe tidak ditemukan. Isi -PsqlPath atau tambahkan folder bin PostgreSQL ke PATH.'
}

function Invoke-PsqlFile([string]$filePath) {
  & $PsqlPath --host=$HostName --port=$Port --username=$User --dbname=$Database --set=ON_ERROR_STOP=1 --file=$filePath
  if ($LASTEXITCODE -ne 0) { throw "psql gagal dengan exit code $LASTEXITCODE" }
}

Write-Host "Membuat schema ami di database $Database ..."
Invoke-PsqlFile $schemaPath

$sqlPath = Join-Path $env:TEMP ("ami_import_{0}.sql" -f ([Guid]::NewGuid().ToString('N')))
try {
  $writer = [System.IO.StreamWriter]::new($sqlPath, $false, [System.Text.UTF8Encoding]::new($false))
  $writer.WriteLine('SET search_path TO ami;')
  $writer.WriteLine('BEGIN;')
  foreach ($tableProperty in $snapshot.tables.psobject.Properties) {
    $tableName = $tableProperty.Name
    $table = $tableProperty.Value
    $columns = @($table.columns | ForEach-Object { '"' + ($_ -replace '"', '""') + '"' })
    foreach ($row in @($table.rows)) {
      $values = foreach ($column in @($table.columns)) {
        $property = $row.psobject.Properties[$column]
        if ($null -eq $property -or $null -eq $property.Value) { 'NULL' }
        else {
          $value = [string]$property.Value
          "'" + ($value -replace "'", "''") + "'"
        }
      }
      $writer.WriteLine(('INSERT INTO "{0}" ({1}) VALUES ({2});' -f ($tableName -replace '"', '""'), ($columns -join ', '), ($values -join ', ')))
    }
  }
  $writer.WriteLine('COMMIT;')
  $writer.Close()
  Write-Host 'Mengimpor baris snapshot ...'
  Invoke-PsqlFile $sqlPath
  Write-Host 'Migrasi selesai.'
} finally {
  if (Test-Path $sqlPath) { Remove-Item $sqlPath -Force }
}
