@echo off
cd /d "%~dp0"
echo Starting server at http://127.0.0.1:8766/index.html
python -m http.server 8766
