param([string]$Python = 'py')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    $venv = '.\.venv\Scripts\python.exe'
    if (Test-Path -LiteralPath '.venv') {
        if (-not (Test-Path -LiteralPath $venv -PathType Leaf)) {
            throw 'The existing .venv is incomplete or belongs to another OS. Back it up outside the repository before creating a new one.'
        }
        & $venv tools\check_environment.py
        if ($LASTEXITCODE -ne 0) { throw 'Existing project environment is not supported.' }
    } else {
        $pythonArgs = @()
        if ([IO.Path]::GetFileNameWithoutExtension($Python) -eq 'py') { $pythonArgs = @('-3.14') }
        & $Python @pythonArgs tools\check_environment.py
        if ($LASTEXITCODE -ne 0) { throw 'Runtime check failed; no project dependencies were installed.' }
        & $Python @pythonArgs -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the project venv.' }
    }
    & $venv -m pip install --disable-pip-version-check -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'JavaScript dependency installation failed.' }
    & $venv -c "import imageio_ffmpeg, subprocess; print(subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-version'], check=True, capture_output=True, text=True).stdout.splitlines()[0])"
    if ($LASTEXITCODE -ne 0) { throw 'FFmpeg verification failed.' }
    Write-Output 'Office Cast is ready. Configure settings.local.json, then use tools\pipeline.py.'
} finally {
    Pop-Location
}
