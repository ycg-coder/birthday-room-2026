#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Starting server at http://127.0.0.1:8766/index.html"
python3 -m http.server 8766
