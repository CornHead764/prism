# setup-https.ps1 — Generate a locally-trusted TLS certificate for Prism.
#
# Run this once on the server. Requires mkcert:
#   winget install FiloSottile.mkcert
#
# After running this script:
#   1. docker compose up -d --build   (starts nginx on port 443)
#   2. Install the CA on the Wyse — see instructions printed at the end.

$ErrorActionPreference = "Stop"

# --- Config ---
# Add your server's local IP and any hostnames you want the cert to cover.
# Separate multiple values with spaces.
$DOMAINS = "192.168.1.236 localhost 127.0.0.1"

# Where certs land (mounted into the nginx container)
$CERT_DIR = "$PSScriptRoot\..\config\certs"

# --------------

Write-Host ""
Write-Host "Prism HTTPS Setup" -ForegroundColor Cyan
Write-Host "=================" -ForegroundColor Cyan
Write-Host ""

# Check mkcert is installed
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Host "mkcert not found. Install it with:" -ForegroundColor Red
    Write-Host "  winget install FiloSottile.mkcert" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Install the local CA into the Windows trust store (safe to run multiple times)
Write-Host "Installing local CA..." -ForegroundColor Green
mkcert -install

# Create cert dir
New-Item -ItemType Directory -Force -Path $CERT_DIR | Out-Null

# Generate the cert
Write-Host "Generating certificate for: $DOMAINS" -ForegroundColor Green
Push-Location $CERT_DIR
$domainArgs = $DOMAINS -split " "
& mkcert -cert-file prism.crt -key-file prism.key @domainArgs
Pop-Location

Write-Host ""
Write-Host "Certificate written to config\certs\" -ForegroundColor Green
Write-Host ""

# Find the CA root cert so user can copy it to the Wyse
$caRoot = & mkcert -CAROOT
$caCert = Join-Path $caRoot "rootCA.pem"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Bring up the nginx service:" -ForegroundColor White
Write-Host "   docker compose up -d --build" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Copy the CA cert to the Wyse:" -ForegroundColor White
Write-Host "   CA cert is at: $caCert" -ForegroundColor Yellow
Write-Host "   scp `"$caCert`" dietpi@192.168.1.236:~/prism-ca.pem" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. On the Wyse, run:" -ForegroundColor White
Write-Host "   sudo cp ~/prism-ca.pem /usr/local/share/ca-certificates/prism-ca.crt" -ForegroundColor Yellow
Write-Host "   sudo update-ca-certificates" -ForegroundColor Yellow
Write-Host "   mkdir -p ~/.pki/nssdb" -ForegroundColor Yellow
Write-Host "   certutil -d sql:`$HOME/.pki/nssdb -A -t 'CT,,' -n 'Prism Local CA' -i ~/prism-ca.pem" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Update the Wyse kiosk URL to:" -ForegroundColor White
Write-Host "   https://192.168.1.236" -ForegroundColor Yellow
Write-Host ""
Write-Host "Done. Prism will be available at https://192.168.1.236" -ForegroundColor Green
Write-Host ""
