param([string]$Root)
$json = Get-Content -Raw (Join-Path $Root "app.json") | ConvertFrom-Json
Write-Host "$($json.expo.version) $($json.expo.android.versionCode)"
