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

$nsisListing = & $sevenZipPath l -slt $nsisInstaller.FullName
if ($LASTEXITCODE -ne 0) {
    throw "7-Zip failed to inspect $($nsisInstaller.FullName)"
}
$nsisListingText = $nsisListing -join [Environment]::NewLine
foreach ($resource in $requiredResources) {
    $escapedResource = [regex]::Escape($resource)
    if ($nsisListingText -notmatch "(?m)^Path = (?:.*[\\/])?$escapedResource\r?$") {
        throw "Missing required ONNX Runtime resource '$resource' in $($nsisInstaller.FullName)"
    }
}
Write-Host "Verified ONNX Runtime resources in $($nsisInstaller.FullName)"

function Get-MsiFileNames {
    param([Parameter(Mandatory = $true)][string]$Path)

    $installer = $null
    $database = $null
    $view = $null
    try {
        $installer = New-Object -ComObject WindowsInstaller.Installer
        $database = $installer.GetType().InvokeMember(
            "OpenDatabase", "InvokeMethod", $null, $installer, @($Path, 0)
        )
        $view = $database.GetType().InvokeMember(
            "OpenView", "InvokeMethod", $null, $database, @("SELECT ``FileName`` FROM ``File``")
        )
        $view.GetType().InvokeMember("Execute", "InvokeMethod", $null, $view, $null) | Out-Null

        while ($true) {
            $record = $view.GetType().InvokeMember("Fetch", "InvokeMethod", $null, $view, $null)
            if ($null -eq $record) {
                break
            }
            try {
                $record.GetType().InvokeMember("StringData", "GetProperty", $null, $record, 1)
            } finally {
                [Runtime.InteropServices.Marshal]::FinalReleaseComObject($record) | Out-Null
            }
        }
    } finally {
        if ($null -ne $view) {
            [Runtime.InteropServices.Marshal]::FinalReleaseComObject($view) | Out-Null
        }
        if ($null -ne $database) {
            [Runtime.InteropServices.Marshal]::FinalReleaseComObject($database) | Out-Null
        }
        if ($null -ne $installer) {
            [Runtime.InteropServices.Marshal]::FinalReleaseComObject($installer) | Out-Null
        }
    }
}

$msiFileNames = @(Get-MsiFileNames -Path $msiInstaller.FullName)
foreach ($resource in $requiredResources) {
    $found = $msiFileNames | Where-Object {
        (($_ -split "\|")[-1]) -ieq $resource
    }
    if (-not $found) {
        throw "Missing required ONNX Runtime resource '$resource' in $($msiInstaller.FullName)"
    }
}
Write-Host "Verified ONNX Runtime resources in $($msiInstaller.FullName)"
