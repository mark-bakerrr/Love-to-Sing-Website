# Downloads all media for the livestream overlays from the Shopify CDN.
# Media is gitignored (large binaries); run this once after cloning, then `vercel deploy`.
# Source of truth for these URLs: the live lovetosing.com countdown/santa pages (theme t/106).

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$files = @(
  # Christmas countdown
  @{ url = 'https://lovetosing.com/cdn/shop/t/106/assets/Red%20Countdown%20Background.jpg'; out = 'media/christmas/background.jpg' }
  @{ url = 'https://lovetosing.com/cdn/shop/videos/c/vp/679007711920473bbdd72fe9f8c927a9/679007711920473bbdd72fe9f8c927a9.HD-1080p-7.2Mbps-91980481.mp4'; out = 'media/christmas/background-video.mp4' }
  @{ url = 'https://lovetosing.com/cdn/shop/files/Love_to_Sing_Christmas_Logo.png?v=1772056051&width=720'; out = 'media/christmas/logo.png' }

  # Halloween countdown
  @{ url = 'https://lovetosing.com/cdn/shop/t/106/assets/halloween-countdown-bg.png'; out = 'media/halloween/background.png' }
  @{ url = 'https://lovetosing.com/cdn/shop/videos/c/vp/85cddb917bbb4da186d2db060cce8c2a/85cddb917bbb4da186d2db060cce8c2a.HD-1080p-7.2Mbps-91890756.mp4'; out = 'media/halloween/background-video.mp4' }
  @{ url = 'https://lovetosing.com/cdn/shop/files/LTS_Logo_Halloween_Final.png?v=1764204480&width=720'; out = 'media/halloween/logo.png' }

  # Santa tracker
  @{ url = 'https://lovetosing.com/cdn/shop/t/106/assets/santa-village-bg.mp4'; out = 'media/santa/village-bg.mp4' }
  @{ url = 'https://lovetosing.com/cdn/shop/t/106/assets/santa-earth.jpg'; out = 'media/santa/earth.jpg' }
  @{ url = 'https://lovetosing.com/cdn/shop/t/106/assets/santa-earth-night.jpg'; out = 'media/santa/earth-night.jpg' }
  @{ url = 'https://lovetosing.com/cdn/shop/t/106/assets/santa-earth-clouds.png'; out = 'media/santa/earth-clouds.png' }
  @{ url = 'https://lovetosing.com/cdn/shop/t/106/assets/santa-earth-spec.jpg'; out = 'media/santa/earth-spec.jpg' }
  @{ url = 'https://lovetosing.com/cdn/shop/t/106/assets/santa-sleigh.glb'; out = 'media/santa/sleigh.glb' }
  @{ url = 'https://lovetosing.com/cdn/shop/t/106/assets/santa-reindeer.glb'; out = 'media/santa/reindeer.glb' }
  @{ url = 'https://lovetosing.com/cdn/shop/t/106/assets/santa-rudolph.glb'; out = 'media/santa/rudolph.glb' }
  @{ url = 'https://lovetosing.com/cdn/shop/files/Love_to_Sing_Christmas_Logo.png?v=1772056051&width=180'; out = 'media/santa/logo-180.png' }
  @{ url = 'https://lovetosing.com/cdn/shop/files/Love_to_Sing_Christmas_Logo.png?v=1772056051&width=360'; out = 'media/santa/logo-360.png' }
)

foreach ($f in $files) {
  $dir = Split-Path $f.out -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  if (Test-Path $f.out) { Write-Host "skip   $($f.out)"; continue }
  Write-Host "fetch  $($f.out)"
  curl.exe -sfL $f.url -o $f.out
  if ($LASTEXITCODE -ne 0) { throw "Download failed: $($f.url)" }
}
Write-Host "Done. $(( Get-ChildItem media -Recurse -File | Measure-Object Length -Sum ).Sum / 1MB) MB total."
