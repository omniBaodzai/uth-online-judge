# Chạy kiểm tra ràng buộc 009 trên container PostgreSQL TẠM (không công bố cổng, tự xóa). Không đụng DB thật.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot\..\..\sql\migrations").Path
$check = (Resolve-Path "$PSScriptRoot\009_discussion_interactions.check.sql").Path
$name = "uth-009-check-$PID"
try {
  docker run -d --rm --name $name -e POSTGRES_PASSWORD=x -v "${root}:/migrations:ro" -v "${check}:/check.sql:ro" postgres:17-alpine | Out-Null
  for ($i = 0; $i -lt 30; $i++) { docker exec $name pg_isready -U postgres 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 1 }
  Start-Sleep 3
  docker exec $name psql -U postgres -v ON_ERROR_STOP=1 -f /check.sql
} finally {
  docker rm -f $name 2>$null | Out-Null
}
