$ErrorActionPreference = 'Stop'

# Paths (relative to this script location)
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$VenvDir = Join-Path $Backend '.venv'
$VenvPy = Join-Path $VenvDir 'Scripts/python.exe'

function Resolve-PythonLauncher {
  $pyCmd = Get-Command py -ErrorAction SilentlyContinue
  $candidates = @('3.14', '3.13', '3.12', '3.11', '3.10')
  if ($pyCmd) {
    foreach ($ver in $candidates) {
      & py -$ver -c "import sys" 2>$null
      if ($LASTEXITCODE -eq 0) {
        return "py -$ver"
      }
    }
    return "py -3"
  }

  $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
  if ($pythonCmd) {
    return "python"
  }

  throw "Python tidak ditemukan di PATH. Install Python 3.10+ dan centang 'Install launcher for all users / Add to PATH'."
}

$PyLauncher = Resolve-PythonLauncher
Write-Host "[DEV] Python launcher yang digunakan: $PyLauncher" -ForegroundColor Cyan

Write-Host "[DEV] Root: $Root" -ForegroundColor Cyan

# 1) Ensure Python venv exists (Python 3.12 recommended)
if (-not (Test-Path $VenvPy)) {
  Write-Host "[DEV] Membuat virtualenv backend (.venv)" -ForegroundColor Yellow
  pushd $Backend
  Invoke-Expression "$PyLauncher -m venv .venv"
  popd
}

# 2) Sinkronisasi dependency backend setiap menjalankan dev
Write-Host "[DEV] Memastikan dependency backend terpasang (pip install -r requirements.txt)" -ForegroundColor Yellow
& $VenvPy -m pip install --upgrade pip | Out-Null
& $VenvPy -m pip install -r (Join-Path $Backend 'requirements.txt')

# 3) Start backend in a new PowerShell window (blok terpisah)
Write-Host "[DEV] Menjalankan backend (uvicorn)..." -ForegroundColor Green
$BackendProc = Start-Process -FilePath $VenvPy `
  -ArgumentList @('-m','uvicorn','backend.main:app','--reload','--port','8000') `
  -WorkingDirectory $Root `
  -WindowStyle Normal `
  -PassThru

# 3b) Wait for backend health 
$healthy = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $res = Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 2
    if ($res.StatusCode -eq 200) { $healthy = $true; break }
  } catch { }
  Start-Sleep -Milliseconds 800
}
if (-not $healthy) {
  Write-Host "[DEV][WARN] Backend belum merespons di http://localhost:8000/health" -ForegroundColor Yellow
  Write-Host "             Jika jendela backend menutup sendiri, coba jalankan manual:" -ForegroundColor Yellow
  Write-Host "             cd `"$Backend`"; .\\.venv\\Scripts\\Activate.ps1; python -m uvicorn backend.main:app --reload --port 8000" -ForegroundColor Yellow
}

# 4) Start frontend dev server in current window
Write-Host "[DEV] Menjalankan frontend (Vite 5175)" -ForegroundColor Green
pushd $Frontend
# Install deps frontend setiap kali
Write-Host "[DEV] Menginstal / menyelaraskan dependency frontend (npm install)" -ForegroundColor Yellow
npm install
npm run dev:5175
popd
