# Tiny local web server for testing the app (no install needed).
# Run from the App folder:  powershell -ExecutionPolicy Bypass -File tools\serve.ps1
# Then open http://localhost:8765
param([int]$Port = 8765)
$root = Split-Path -Parent $PSScriptRoot
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.png'='image/png'; '.woff2'='font/woff2'; '.svg'='image/svg+xml' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Serving $root at http://localhost:$Port"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $p = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($p -eq '') { $p = 'index.html' }
  $f = Join-Path $root $p
  $res = $ctx.Response
  if ((Test-Path $f -PathType Leaf) -and ([IO.Path]::GetFullPath($f)).StartsWith($root)) {
    $b = [IO.File]::ReadAllBytes($f)
    $ext = [IO.Path]::GetExtension($f).ToLower()
    $res.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
    $res.Headers.Add('Cache-Control', 'no-cache')
    $res.OutputStream.Write($b, 0, $b.Length)
  } else { $res.StatusCode = 404 }
  $res.Close()
  Write-Host "$($ctx.Request.HttpMethod) /$p $($res.StatusCode)"
}
