#!/bin/sh
# Roda os testes de regressão. Usa o Node do sistema; sem ele, o runtime Node
# embutido no VS Code (Electron com ELECTRON_RUN_AS_NODE=1).
cd "$(dirname "$0")/.." || exit 1

NODE=""
if command -v node >/dev/null 2>&1; then
  NODE="node"
else
  for c in \
    "/c/Program Files/Microsoft VS Code/Code.exe" \
    "$HOME/AppData/Local/Programs/Microsoft VS Code/Code.exe" \
    "/Applications/Visual Studio Code.app/Contents/MacOS/Electron" \
    "/usr/share/code/code"; do
    if [ -x "$c" ]; then NODE="$c"; export ELECTRON_RUN_AS_NODE=1; break; fi
  done
fi
if [ -z "$NODE" ]; then
  echo "Node.js não encontrado. Instale o Node 20+ para rodar os testes." >&2
  exit 1
fi

"$NODE" tools/test.cjs
