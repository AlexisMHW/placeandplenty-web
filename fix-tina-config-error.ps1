# Fix TypeScript error in tina/config.ts
# Run this from inside your placeandplenty-web project folder
# (the one at Downloads\placeandplenty-web (2)\placeandplenty-web)

$file = "tina\config.ts"

if (-not (Test-Path -LiteralPath $file)) {
    Write-Host "Could not find $file - make sure you're running this from the correct project folder." -ForegroundColor Red
    exit
}

$oldLine = '        ui: { defaultItemValue: "The Coordinated Host by Place & Plenty" },'
$newLine = '        ui: { defaultValue: "The Coordinated Host by Place & Plenty" },'

$content = Get-Content -LiteralPath $file -Raw

if ($content -notmatch [regex]::Escape($oldLine)) {
    Write-Host "Could not find the expected line in the file. No changes made - please check tina/config.ts manually around line 65." -ForegroundColor Yellow
    exit
}

$content = $content -replace [regex]::Escape($oldLine), $newLine
Set-Content -LiteralPath $file -Value $content -NoNewline

Write-Host "Fixed! Line 65 updated in $file" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  git add ."
Write-Host "  git commit -m 'Fix Tina config defaultItemValue error'"
Write-Host "  git push"
