# Sentiment Service Test Script for Windows
# Kiểm tra các API endpoints của sentiment service

param(
    [string]$SentimentUrl = $env:SENTIMENT_SERVICE_URL
)

if (-not $SentimentUrl) {
    $SentimentUrl = "http://localhost:8000"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Testing Sentiment Service" -ForegroundColor Cyan
Write-Host "URL: $SentimentUrl" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

function Test-Endpoint {
    param(
        [string]$TestName,
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [int]$ExpectedStatus = 200
    )
    
    Write-Host "Test: $TestName" -ForegroundColor Yellow
    
    try {
        $uri = "$SentimentUrl$Endpoint"
        $params = @{
            Uri = $uri
            Method = $Method
            ContentType = "application/json"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params -ErrorAction Stop
        
        Write-Host "✓ Test passed" -ForegroundColor Green
        Write-Host "Response:" -ForegroundColor Gray
        Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray
        Write-Host ""
        return $true
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "✓ Test passed (Expected error: $statusCode)" -ForegroundColor Green
        } else {
            Write-Host "✗ Test failed" -ForegroundColor Red
            Write-Host "Status: $statusCode" -ForegroundColor Red
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        }
        Write-Host ""
        return $false
    }
}

# Test 1: Health Check
Test-Endpoint -TestName "Health Check" `
    -Method "GET" `
    -Endpoint "/health"

# Test 2: Analyze Positive Text
Test-Endpoint -TestName "Analyze Positive Text" `
    -Method "POST" `
    -Endpoint "/analyze" `
    -Body @{
        text = "Tôi rất vui và hạnh phúc hôm nay!"
    }

# Test 3: Analyze Negative Text
Test-Endpoint -TestName "Analyze Negative Text" `
    -Method "POST" `
    -Endpoint "/analyze" `
    -Body @{
        text = "Tôi rất buồn và thất vọng"
    }

# Test 4: Analyze Neutral Text
Test-Endpoint -TestName "Analyze Neutral Text" `
    -Method "POST" `
    -Endpoint "/analyze" `
    -Body @{
        text = "Hôm nay trời nắng đẹp"
    }

# Test 5: Batch Analyze
Test-Endpoint -TestName "Batch Analyze" `
    -Method "POST" `
    -Endpoint "/analyze/batch" `
    -Body @{
        texts = @(
            "Tôi rất yêu thích sản phẩm này!",
            "Dịch vụ tệ quá",
            "Bình thường thôi"
        )
    }

# Test 6: Error Handling (Empty Text)
Write-Host "Test: Error Handling (Empty Text)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$SentimentUrl/analyze" `
        -Method POST `
        -ContentType "application/json" `
        -Body '{"text":""}' `
        -ErrorAction Stop
    
    Write-Host "✗ Test failed (Should return error)" -ForegroundColor Red
    Write-Host ""
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 400) {
        Write-Host "✓ Error handling correct (HTTP 400)" -ForegroundColor Green
    } else {
        Write-Host "✗ Unexpected status code: $statusCode" -ForegroundColor Red
    }
    Write-Host ""
}

# Test 7: Legacy Endpoint
Test-Endpoint -TestName "Legacy Endpoint (/predict)" `
    -Method "POST" `
    -Endpoint "/predict" `
    -Body @{
        text = "Test legacy endpoint"
    }

# Test 8: With Metadata
Test-Endpoint -TestName "Analyze with Metadata" `
    -Method "POST" `
    -Endpoint "/analyze" `
    -Body @{
        text = "Bài viết rất hay và bổ ích"
        user_id = "user123"
        entity_id = "post456"
        entity_type = "post"
    }

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Testing completed!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
