@echo off
setlocal

set IMAGE=ghcr.io/mj426382/allgrafika-backend:latest

echo === Building Docker image: %IMAGE% ===
docker build -t %IMAGE% .
if %errorlevel% neq 0 (
    echo ERROR: Docker build failed!
    exit /b 1
)

echo === Pushing image to GHCR ===
docker push %IMAGE%
if %errorlevel% neq 0 (
    echo ERROR: Docker push failed! Make sure you are logged in:
    echo   docker login ghcr.io -u mj426382
    exit /b 1
)

echo === Done! Image pushed: %IMAGE% ===
endlocal
