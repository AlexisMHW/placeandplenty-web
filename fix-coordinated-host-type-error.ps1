# Fix TypeScript error in app/coordinated-host/[slug]/page.tsx
# Run this from inside your placeandplenty-web project folder
# (the one at Downloads\placeandplenty-web (2)\placeandplenty-web)

$file = "app\coordinated-host\[slug]\page.tsx"

if (-not (Test-Path -LiteralPath $file)) {
    Write-Host "Could not find $file - make sure you're running this from the correct project folder." -ForegroundColor Red
    exit
}

$oldLine = "    description: post.socialDescription || post.metaDescription || post.deck,"
$newLine = "    description: post.socialDescription || post.metaDescription || post.deck || undefined,"

$content = Get-Content -LiteralPath $file -Raw

if ($content -notmatch [regex]::Escape($oldLine)) {
    Write-Host "Could not find the expected line in the file. No changes made - please check the file manually around line 26." -ForegroundColor Yellow
    exit
}

$content = $content -replace [regex]::Escape($oldLine), $newLine
Set-Content -LiteralPath $file -Value $content -NoNewline

Write-Host "Fixed! Line 26 updated in $file" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  git add ." 
Write-Host "  git commit -m 'Fix openGraph description type error'"
Write-Host "  git push"
