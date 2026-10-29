$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/aktifkan-alat.ps1"

function Invoke-ReleaseCheck {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Pemeriksaan gagal: $Command $($Arguments -join ' ') (exit $LASTEXITCODE)"
    }
}

Push-Location (Split-Path $PSScriptRoot -Parent)
$previewServer = $null
$previousPreviewUrl = $env:UTP_PREVIEW_URL
try {
    Invoke-ReleaseCheck node @('alat/buat-sumber-clasp.js')
    Invoke-ReleaseCheck node @('--test', 'pengujian/*.test.js')
    Invoke-ReleaseCheck npm.cmd @('run', 'test:memory')
    Invoke-ReleaseCheck python @('alat/buat-pratinjau.py')

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $previewPort = $listener.LocalEndpoint.Port
    $listener.Stop()
    $env:UTP_PREVIEW_URL = "http://127.0.0.1:$previewPort/aplikasi.html"
    $previewServer = Start-Process -FilePath (Get-Command python).Source `
        -ArgumentList @('-m', 'http.server', "$previewPort", '--bind', '127.0.0.1', '--directory', '.local') `
        -WorkingDirectory $PWD.Path -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput '.local/preview-server.log' -RedirectStandardError '.local/preview-server-error.log'
    $previewReady = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if ($previewServer.HasExited) { throw 'Server preview berhenti sebelum siap.' }
        try {
            $response = Invoke-WebRequest -Uri $env:UTP_PREVIEW_URL -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200) { $previewReady = $true; break }
        }
        catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $previewReady) { throw 'Server preview tidak siap.' }

    $browser = @(
        $env:CHROMIUM_BIN
        "$env:PROGRAMFILES/Google/Chrome/Application/chrome.exe"
        "${env:PROGRAMFILES(X86)}/Microsoft/Edge/Application/msedge.exe"
        "$env:LOCALAPPDATA/Google/Chrome/Application/chrome.exe"
        "$env:PROGRAMFILES/Microsoft/Edge/Application/msedge.exe"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
    if ($browser) { $env:CHROMIUM_BIN = $browser }
    foreach ($check in Get-ChildItem "$PSScriptRoot/periksa-*.cjs" | Sort-Object Name) {
        $checkArguments = @($check.FullName, 'playwright')
        if ($browser) { $checkArguments += $browser }
        Invoke-ReleaseCheck node $checkArguments
    }
    Invoke-ReleaseCheck npm.cmd @('run', 'test:ui')
    Write-Output 'LULUS: generator, tes backend/memory, preview, dan tes browser. Tidak ada upload/deployment.'
}
finally {
    if ($previewServer -and -not $previewServer.HasExited) { Stop-Process -Id $previewServer.Id }
    $env:UTP_PREVIEW_URL = $previousPreviewUrl
    Pop-Location
}
