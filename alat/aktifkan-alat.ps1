# Dot-source this file to use the project's ignored portable tools in this shell.
$utpTools = Join-Path (Split-Path $PSScriptRoot -Parent) '.local/tools'
$utpToolPaths = @(
    Get-ChildItem -LiteralPath $utpTools -Directory -Filter 'node-v*-win-x64' -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty FullName
    Join-Path $utpTools 'clasp'
    Join-Path $utpTools 'python'
    Join-Path $utpTools 'ripgrep'
) | Where-Object { Test-Path -LiteralPath $_ }
foreach ($utpToolPath in $utpToolPaths) {
    if (($env:PATH -split ';') -notcontains $utpToolPath) {
        $env:PATH = "$utpToolPath;$env:PATH"
    }
}
