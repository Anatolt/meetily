param(
    [Parameter(Mandatory = $false)]
    [string]$SearchRoot = "target"
)

$ErrorActionPreference = "Stop"

$resolvedRoot = Resolve-Path -LiteralPath $SearchRoot
$nsisInstaller = Get-ChildItem -LiteralPath $resolvedRoot -Recurse -File -Filter "*-setup.exe" |
    Where-Object { $_.DirectoryName -match "[\\/]bundle[\\/]nsis$" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
$msiInstaller = Get-ChildItem -LiteralPath $resolvedRoot -Recurse -File -Filter "*.msi" |
    Where-Object { $_.DirectoryName -match "[\\/]bundle[\\/]msi$" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $nsisInstaller) {
    throw "No NSIS installer was found under $resolvedRoot"
}
if (-not $msiInstaller) {
    throw "No MSI installer was found under $resolvedRoot"
}

$installers = @($nsisInstaller, $msiInstaller)
$sevenZip = Get-Command 7z.exe -ErrorAction SilentlyContinue
if (-not $sevenZip) {
    $defaultSevenZip = "C:\Program Files\7-Zip\7z.exe"
    if (-not (Test-Path -LiteralPath $defaultSevenZip)) {
        throw "7-Zip is required to verify the NSIS installer contents"
    }
    $sevenZipPath = $defaultSevenZip
} else {
    $sevenZipPath = $sevenZip.Source
}

$requiredResources = @(
    "onnxruntime.dll",
    "onnxruntime_providers_shared.dll",
    "onnxruntime-LICENSE.txt"
)

foreach ($installer in $installers) {
    $listing = & $sevenZipPath l -slt $installer.FullName
    if ($LASTEXITCODE -ne 0) {
        throw "7-Zip failed to inspect $($installer.FullName)"
    }
    $listingText = $listing -join [Environment]::NewLine

    foreach ($resource in $requiredResources) {
        $escapedResource = [regex]::Escape($resource)
        if ($listingText -notmatch "(?m)^Path = (?:.*[\\/])?$escapedResource\r?$") {
            throw "Missing required ONNX Runtime resource '$resource' in $($installer.FullName)"
        }
    }

    Write-Host "Verified ONNX Runtime resources in $($installer.FullName)"
}
