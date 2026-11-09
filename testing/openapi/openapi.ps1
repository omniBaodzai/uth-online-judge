
# ==========================================
# OpenAPI Specification Analyzer
# ==========================================

# Lấy đường dẫn thư mục chứa file script
$scriptDir = $PSScriptRoot

# Đường dẫn đến file openapi.json
$jsonPath = Join-Path $scriptDir "openapi.json"

# Kiểm tra file JSON có tồn tại không
if (-not (Test-Path $jsonPath)) {
    Write-Host "ERROR: Cannot find openapi.json!" -ForegroundColor Red
    Write-Host "Expected path: $jsonPath"
    exit 1
}

# Đọc và parse JSON
try {
    $spec = Get-Content $jsonPath -Raw | ConvertFrom-Json
}
catch {
    Write-Host "ERROR: Cannot parse OpenAPI JSON!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

# Kiểm tra cấu trúc OpenAPI
if (-not $spec.openapi -or -not $spec.info -or -not $spec.paths) {
    Write-Host "ERROR: Invalid OpenAPI specification!" -ForegroundColor Red
    exit 1
}

# Các HTTP methods cần thống kê
$methods = @("get", "post", "put", "patch", "delete")

# Khởi tạo bộ đếm
$count = 0

# Thống kê số lượng API operations
foreach ($path in $spec.paths.PSObject.Properties) {

    foreach ($operation in $path.Value.PSObject.Properties) {

        if ($operation.Name.ToLower() -in $methods) {
            $count++
        }

    }
}

# Hiển thị kết quả
Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "       OPENAPI ANALYSIS RESULT      " -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

Write-Host "OpenAPI Version:       $($spec.openapi)"
Write-Host "API Version:           $($spec.info.version)"
Write-Host "Total API Operations:  $count" -ForegroundColor Green

Write-Host "====================================" -ForegroundColor Cyan
