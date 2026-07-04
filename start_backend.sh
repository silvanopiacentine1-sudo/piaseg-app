#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME="/Users/silvanopiacentine"
export PYTHONPATH=""

cd /Users/silvanopiacentine/Desktop/trabalho/piaseg-app/backend
exec /usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
