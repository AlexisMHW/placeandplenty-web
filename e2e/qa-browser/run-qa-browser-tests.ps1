<#
  Place & Plenty - browser tests against QA.
  Run with exactly:   powershell -ExecutionPolicy Bypass -File run-qa-browser-tests.ps1

  What it does: checks your setup, installs the test tools the first time, starts the website on your own computer pointed at the
  QA project, runs the tests, and packs screenshots + a results summary into one zip you can send back.
  What it never does: print your keys or passwords, touch production, or send anything anywhere except to the QA project.
  Note: these are BROWSER tests against QA. They are NOT proof that the released iPhone/Android apps work.
#>
param(
  [string]$BaseUrl = $env:QA_WEB_BASE_URL,   # optional: test an already-running site instead of starting one
  [switch]$PublicOnly,                        # run only the tests that need no test account
  [string]$Grep = ''                          # optional: run only tests whose name contains this text
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$QaRef = 'gpzlytukyvshrrxrmooo'
$Suite = $PSScriptRoot
$Repo  = Resolve-Path (Join-Path $Suite '..\..')
$Port  = 3100
$webProc = $null

function Say($m)  { Write-Host "[QA browser tests] $m" }
function Stop-Here($m) { Write-Host ""; Write-Host "STOPPED: $m" -ForegroundColor Yellow; exit 2 }

# ---- 1. read QA settings without ever printing them ------------------------------------------------------------
function Read-EnvFile($path) {
  $h = @{}
  if (Test-Path $path) {
    Get-Content $path | ForEach-Object {
      if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$') { $h[$Matches[1]] = $Matches[2].Trim('"').Trim("'") }
    }
  }
  return $h
}
$fileVals = @{}
foreach ($f in @((Join-Path $Repo '.env.local'), (Join-Path $Suite '.env.local'))) {
  $v = Read-EnvFile $f; foreach ($k in $v.Keys) { $fileVals[$k] = $v[$k] }
}
function Pick($names) {
  foreach ($n in $names) {
    $e = [Environment]::GetEnvironmentVariable($n)
    if ($e) { return $e }
    if ($fileVals.ContainsKey($n) -and $fileVals[$n]) { return $fileVals[$n] }
  }
  return ''
}
$qaUrl  = Pick @('QA_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL')
$qaKey  = Pick @('QA_SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY')
$credFile = Pick @('QA_E2E_CREDENTIALS_FILE')
$hostEmail = Pick @('QA_E2E_HOST_EMAIL')

Say ("QA address:   " + $(if ($qaUrl) { 'found' } else { 'MISSING' }))
Say ("QA key:       " + $(if ($qaKey) { 'found' } else { 'MISSING' }))
Say ("Test account: " + $(if (($credFile -and (Test-Path $credFile)) -or $hostEmail) { 'found' } else { 'not supplied (account tests will be skipped)' }))

if (-not $qaUrl -or -not $qaKey) {
  Stop-Here "Put QA_SUPABASE_URL and QA_SUPABASE_ANON_KEY in your Windows environment variables, or in a file named .env.local in the website folder ($Repo). Nothing was run."
}
if ($qaUrl -notmatch [regex]::Escape($QaRef)) {
  Stop-Here "The address you supplied is not the QA project. These tests only ever run against QA. Nothing was run."
}
$env:QA_SUPABASE_URL = $qaUrl
$env:QA_SUPABASE_ANON_KEY = $qaKey
if ($credFile) { $env:QA_E2E_CREDENTIALS_FILE = $credFile }
if ($PublicOnly) { Remove-Item Env:QA_E2E_CREDENTIALS_FILE -ErrorAction SilentlyContinue; Remove-Item Env:QA_E2E_HOST_EMAIL -ErrorAction SilentlyContinue; Remove-Item Env:QA_E2E_HOST_PASSWORD -ErrorAction SilentlyContinue }

# ---- 2. tools -----------------------------------------------------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Stop-Here "Node.js is not installed. Install the LTS version from nodejs.org, then run this again." }
$nodeMajor = [int]((node --version) -replace '^v(\d+).*','$1')
if ($nodeMajor -lt 18) { Stop-Here "Node.js is too old (need 18 or newer). Install the LTS version from nodejs.org." }

Push-Location $Suite
try {
  if (-not (Test-Path (Join-Path $Suite 'node_modules'))) { Say 'First run: installing test tools (a few minutes)...'; npm install --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { Stop-Here 'npm install failed.' } }
  Say 'Making sure the test browser is installed...'
  npx playwright install chromium
  if ($LASTEXITCODE -ne 0) { Stop-Here 'Could not install the test browser.' }

  # ---- 3. the website under test ------------------------------------------------------------------------------------
  if (-not $BaseUrl) {
    if (-not (Test-Path (Join-Path $Repo 'package.json'))) { Stop-Here "Cannot find the website folder two levels above this script ($Repo). Put this e2e\qa-browser folder inside the website project, or pass -BaseUrl http://your-qa-site." }
    $BaseUrl = "http://localhost:$Port"
    Say "Starting the website on your computer, pointed at QA ($BaseUrl) ..."
    $env:NEXT_PUBLIC_SUPABASE_URL = $qaUrl
    $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $qaKey
    $env:NEXT_PUBLIC_SITE_URL = $BaseUrl
    $env:NEXT_TELEMETRY_DISABLED = '1'
    if (-not (Test-Path (Join-Path $Repo 'node_modules'))) { Say 'Installing website packages (first time only)...'; Push-Location $Repo; npm install --no-audit --no-fund; Pop-Location }
    $webProc = Start-Process -FilePath 'cmd.exe' -ArgumentList "/c npx next dev -p $Port" -WorkingDirectory $Repo -PassThru -WindowStyle Minimized
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Seconds 3
      try { $r = Invoke-WebRequest -Uri "$BaseUrl/login" -UseBasicParsing -TimeoutSec 10; if ($r.StatusCode -eq 200) { $ready = $true; break } } catch { }
    }
    if (-not $ready) { Stop-Here 'The website did not start within 3 minutes.' }
  }
  $env:QA_WEB_BASE_URL = $BaseUrl

  # ---- 4. run ------------------------------------------------------------------------------------------------------------
  Remove-Item (Join-Path $Suite 'test-results') -Recurse -Force -ErrorAction SilentlyContinue
  $pwArgs = @('playwright','test')
  if ($PublicOnly) { $pwArgs += @('tests/01_public_pages.spec.ts','tests/02_privacy_network.spec.ts') }
  if ($Grep) { $pwArgs += @('-g', $Grep) }
  Say 'Running the tests (a few minutes). Please leave the computer alone until it finishes.'
  & npx @pwArgs
  $testExit = $LASTEXITCODE

  # ---- 5. pack what to send back ---------------------------------------------------------------------------------------
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $out = Join-Path $Suite "qa-browser-results-$stamp.zip"
  $keep = Join-Path $Suite 'test-results'
  if (Test-Path $keep) {
    Compress-Archive -Path (Join-Path $keep '*') -DestinationPath $out -Force
    Say "Results packed here:  $out"
    Say 'Send me that zip. It contains screenshots, a results summary and the list of test objects created. It does not contain keys or passwords.'
  }
  if (Test-Path (Join-Path $keep 'created-objects.json')) { Say 'Test data was created in QA. Do not delete it yourself; send the zip and I will clean it up by exact id.' }
  if ($testExit -eq 0) { Say 'All tests that ran passed.' } else { Say 'Some tests failed. This is useful information, not a problem with your computer: send the zip.' }
  exit $testExit
}
finally {
  Pop-Location
  if ($webProc -and -not $webProc.HasExited) { & taskkill /PID $webProc.Id /T /F | Out-Null }
}
