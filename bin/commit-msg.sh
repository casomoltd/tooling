#!/bin/sh
# Stop at the first check that fails, so a later one cannot mask it.
set -e
npx --no -- commitlint --edit "$1"
# Resolve the npm bin symlink so the check is found beside this script.
node "$(dirname "$(realpath "$0")")/check-listed-files.mjs" "$1"
