# Draws the app icons with Microsoft Edge (already on Windows; no Node needed).
# Run from the App folder:  powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
# Same artwork as tools/make-icons.js.
$app = Split-Path -Parent $PSScriptRoot
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge not found' }
$tmp = Join-Path $env:TEMP 'hinton-icons'; New-Item -ItemType Directory -Force $tmp | Out-Null
New-Item -ItemType Directory -Force (Join-Path $app 'icons') | Out-Null
function Get-Svg([int]$pad) {
  $rx = if ($pad) { 0 } else { 96 }; $sc = if ($pad) { 0.78 } else { 1 }
@"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#062744"/><stop offset=".6" stop-color="#0a4c7d"/><stop offset="1" stop-color="#0e6ea3"/></linearGradient></defs>
<rect width="512" height="512" rx="$rx" fill="url(#g)"/>
<g transform="translate(256 262) scale($sc) translate(-256 -262)">
<path d="M96 170 h120 l28 30 h172 a20 20 0 0 1 20 20 v190 a20 20 0 0 1 -20 20 h-300 a20 20 0 0 1 -20 -20 v-220 a20 20 0 0 1 20 -20z" fill="#2fb3e0"/>
<path d="M76 236 h360 v174 a20 20 0 0 1 -20 20 h-320 a20 20 0 0 1 -20 -20z" fill="#7fd3f2"/>
<path d="M256 252 c0 0 -58 66 -58 104 a58 58 0 0 0 116 0 c0 -38 -58 -104 -58 -104z" fill="#fff"/>
<path d="M230 360 a28 28 0 0 0 26 26" stroke="#0a4c7d" stroke-width="10" fill="none" stroke-linecap="round"/>
</g></svg>
"@
}
foreach ($i in @(@('icon-192',192,0), @('icon-512',512,0), @('icon-maskable-512',512,1), @('apple-touch-icon',180,1), @('favicon',64,0))) {
  $name, $size, $pad = $i
  $html = Join-Path $tmp "$name.html"
  "<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block;width:${size}px;height:${size}px}</style></head><body>$(Get-Svg $pad)</body></html>" | Out-File $html -Encoding utf8
  $out = Join-Path $app "icons\$name.png"
  $prof = Join-Path $tmp 'profile'
  & $edge --headless=new --disable-gpu --no-first-run --hide-scrollbars "--user-data-dir=$prof" --default-background-color=00000000 "--window-size=$size,$size" "--screenshot=$out" "file:///$($html -replace '\\','/')" | Out-Null
  if (Test-Path $out) { "ok $name ($size px)" } else { "FAILED $name" }
}
