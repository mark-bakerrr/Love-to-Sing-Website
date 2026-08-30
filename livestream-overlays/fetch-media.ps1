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
  @{ url = 'https://lovetosing.com/cdn/shop/files/Christmas_62679af8-d364-49ea-a182-311b2fac9fd8.jpg?v=1782769271&width=240'; out = 'media/christmas/artwork.jpg' }
  @{ url = 'https://cdn.shopify.com/s/files/1/0053/3505/6418/files/1._Jingle_Bells_Lofi_Love_to_Sing.mp3?v=1786955841'; out = 'media/christmas/tracks/01-jingle-bells-lofi.mp3' }
  @{ url = 'https://cdn.shopify.com/s/files/1/0053/3505/6418/files/2._Deck_the_Halls_Lofi_Love_to_Sing.mp3?v=1786955841'; out = 'media/christmas/tracks/02-deck-the-halls-lofi.mp3' }
  @{ url = 'https://cdn.shopify.com/s/files/1/0053/3505/6418/files/3._We_Wish_You_a_Merry_Christmas_Lofi_Love_to_Sing.mp3?v=1786955841'; out = 'media/christmas/tracks/03-we-wish-you-a-merry-christmas-lofi.mp3' }
  @{ url = 'https://cdn.shopify.com/s/files/1/0053/3505/6418/files/4._12_Days_of_Christmas_Lofi_Love_to_Sing.mp3?v=1786955840'; out = 'media/christmas/tracks/04-12-days-of-christmas-lofi.mp3' }
  @{ url = 'https://cdn.shopify.com/s/files/1/0053/3505/6418/files/5._Silent_Night_Lofi_Love_to_Sing.mp3?v=1786955839'; out = 'media/christmas/tracks/05-silent-night-lofi.mp3' }
  @{ url = 'https://cdn.shopify.com/s/files/1/0053/3505/6418/files/6._Joy_to_the_World_Lofi_Love_to_Sing.mp3?v=1786955841'; out = 'media/christmas/tracks/06-joy-to-the-world-lofi.mp3' }
  @{ url = 'https://cdn.shopify.com/s/files/1/0053/3505/6418/files/7._Hark_the_Herald_Angels_Sing_Lofi_Love_to_Sing.mp3?v=1786955840'; out = 'media/christmas/tracks/07-hark-the-herald-angels-sing-lofi.mp3' }
  @{ url = 'https://cdn.shopify.com/s/files/1/0053/3505/6418/files/8._O_Christmas_Tree_Lofi_Love_to_Sing.mp3?v=1786955841'; out = 'media/christmas/tracks/08-o-christmas-tree-lofi.mp3' }
  @{ url = 'https://cdn.shopify.com/s/files/1/0053/3505/6418/files/9._Angels_we_Have_Heard_on_High_Lofi_Love_to_Sing.mp3?v=1786955840'; out = 'media/christmas/tracks/09-angels-we-have-heard-on-high-lofi.mp3' }
  @{ url = 'https://cdn.shopify.com/s/files/1/0053/3505/6418/files/10._O_Come_All_Ye_Faithful_Lofi_Love_to_Sing.mp3?v=1786955840'; out = 'media/christmas/tracks/10-o-come-all-ye-faithful-lofi.mp3' }
  @{ url = 'https://cdn.shopify.com/s/files/1/0053/3505/6418/files/11._The_First_Noel_Lofi_Love_to_Sing.mp3?v=1786955840'; out = 'media/christmas/tracks/11-the-first-noel-lofi.mp3' }

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
