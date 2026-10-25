# Reusable local demo commands; this helper contains no credentials.
# Run-Case submits one self-test case and prints its terminal job record.
function Run-Case($case, $key) {
  $headers = @{ 'Idempotency-Key' = $key }
  if ($env:API_TOKEN) {
    $headers.Authorization = "Bearer $env:API_TOKEN"
  }

  $body = @{ case = $case } | ConvertTo-Json -Compress
  try {
    $job = Invoke-RestMethod -Method Post `
      -Uri 'http://localhost:8000/api/v1/selftest' `
      -Headers $headers -ContentType 'application/json' -Body $body
  } catch {
    $response = $_.Exception.Response
    $statusCode = if ($response) { [int]$response.StatusCode } else { 'unknown' }
    $errorBody = $_.ErrorDetails.Message
    if (-not $errorBody -and $response) {
      $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
      $errorBody = $reader.ReadToEnd()
      $reader.Dispose()
    }
    Write-Output "HTTP error status: $statusCode"
    Write-Output "Error body: $errorBody"
    return
  }

  $jobUri = "http://localhost:8000/api/v1/jobs/$($job.job_id)"
  $lastStatus = $job.status
  for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
    try {
      $job = Invoke-RestMethod -Method Get -Uri $jobUri -Headers $headers
    } catch {
      $response = $_.Exception.Response
      $statusCode = if ($response) { [int]$response.StatusCode } else { 'unknown' }
      $errorBody = $_.ErrorDetails.Message
      Write-Output "HTTP error status: $statusCode"
      Write-Output "Error body: $errorBody"
      return
    }
    $lastStatus = $job.status
    if ($lastStatus -eq 'succeeded' -or $lastStatus -eq 'failed') {
      $job | ConvertTo-Json -Depth 10
      return
    }
    Start-Sleep -Seconds 1
  }

  Write-Output "Timed out after 60 seconds; last status: $lastStatus"
}
