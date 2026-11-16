# Static server for public/ that needs no install (Windows PowerShell 5.1+).
# Double-click start.bat to run it. Close the window to stop.
# ponytail: one request at a time; the parallel CSV fetches just queue. Fine for one viewer.
param([switch]$NoBrowser)

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'public')) + '\'
$port = (Get-Content (Join-Path $root 'config.json') -Raw | ConvertFrom-Json).port
if (-not $port) { $port = 3000 }
$url = "http://localhost:$port/"

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript'; '.json' = 'application/json'
  '.csv'  = 'text/csv; charset=utf-8';  '.sql' = 'text/plain; charset=utf-8'; '.css' = 'text/css'
  '.wasm' = 'application/wasm'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($url)   # localhost prefix: no admin rights, no firewall prompt
try { $listener.Start() } catch {
  Write-Host "Port $port is already in use. Change 'port' in public\config.json." -ForegroundColor Red
  if (-not $NoBrowser) { Read-Host 'Press Enter to exit' }
  exit 1
}

Write-Host "Serving $url - close this window to stop."
if (-not $NoBrowser) { Start-Process $url }

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
    # Only serve files inside public/ (blocks ../ traversal)
    if ($file.StartsWith($root, 'OrdinalIgnoreCase') -and (Test-Path -LiteralPath $file -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $type = $types[[IO.Path]::GetExtension($file).ToLower()]
      $res.ContentType = if ($type) { $type } else { 'application/octet-stream' }
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $res.StatusCode = 404 }
  } catch { $res.StatusCode = 500 } finally { $res.Close() }
}
