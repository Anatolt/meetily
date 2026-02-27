Чеклист под вашу текущую конфигурацию (Windows x64/AMD64):

1. Починить toolchain MSVC (у вас сейчас `cl.exe` не найден, из-за этого и падает сборка `whisper-rs-sys`).
```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools `
  --override "--wait --quiet --norestart --nocache --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.VC.CMake.Project"
```

2. Открывать проект через `x64 Native Tools Command Prompt for VS 2022`  
или в PowerShell перед сборкой вызывать:
```powershell
& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
```

3. Проверить, что инструменты реально доступны:
```powershell
cmd /c where cl
cmd /c where link
cmd /c where msbuild
cmake --version
rustup target add x86_64-pc-windows-msvc
```

4. Полная очистка и установка:
```powershell
rd /s /q node_modules
pnpm install
cargo clean --manifest-path .\src-tauri\Cargo.toml
```

5. Запуск dev-сборки (CPU, самый стабильный старт):
```powershell
pnpm run tauri:dev:cpu
```

6. Если всплывает ошибка про ARM64/не тот target, зафиксировать target:
```powershell
$env:CARGO_BUILD_TARGET="x86_64-pc-windows-msvc"
pnpm run tauri:dev:cpu
```

7. Если блокируются `.ps1/.bat`:
```powershell
Set-ExecutionPolicy -Scope Process Bypass
Unblock-File .\build.ps1,.\build-gpu.ps1,.\dev-gpu.ps1
```

У вас `cmake` уже установлен, ключевой блокер сейчас именно отсутствие MSVC (`cl.exe`) в PATH/сессии.
