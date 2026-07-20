# Sync named keys from an env file to Vercel (production + preview).
# Example:
#   powershell -File scripts/sync-vercel-env.ps1 -EnvFile .env.vercel `
#     -Keys OPS_DATABASE_URL,OPS_DIRECT_URL,BETTER_AUTH_SECRET,BETTER_AUTH_URL,NEXT_PUBLIC_APP_URL
param(
  [Parameter(Mandatory = $true)][string]$EnvFile,
  [Parameter(Mandatory = $true)][string[]]$Keys,
  [string]$Scope = ""
)

$ErrorActionPreference = "Stop"

function Read-EnvMap([string]$path) {
  $map = @{}
  if (-not (Test-Path $path)) { throw "Env file not found: $path" }
  foreach ($line in Get-Content $path -Encoding UTF8) {
    if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
    $eq = $line.IndexOf('=')
    if ($eq -lt 0) { continue }
    $k = $line.Substring(0, $eq).Trim()
    $v = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
    $map[$k] = $v
  }
  return $map
}

$envMap = Read-EnvMap $EnvFile
$scopeArgs = @()
if ($Scope) { $scopeArgs = @("--scope", $Scope) }

foreach ($key in $Keys) {
  if (-not $envMap.ContainsKey($key) -or -not $envMap[$key]) {
    Write-Warning "Skipping $key (missing in $EnvFile)"
    continue
  }
  $val = $envMap[$key]
  foreach ($target in @("production", "preview")) {
    Write-Host "Setting $key ($target)..."
    & npx vercel env add $key $target --value $val --force --yes @scopeArgs
    if ($LASTEXITCODE -ne 0) { throw "vercel env add failed for $key ($target) exit $LASTEXITCODE" }
  }
}

Write-Host "Done. Redeploy for changes to take effect."
