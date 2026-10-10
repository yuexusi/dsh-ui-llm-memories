#!/bin/sh
# Assemble the hand-maintained client bundle from its ordered source parts.
set -eu
cd "$(dirname "$0")"
cat src/01-head.js src/02-locale.js src/03-rpc.js src/04-css.js src/05-view.js src/06-apply.js \
    > lib/client.js
node --check lib/client.js
echo "built lib/client.js ($(wc -c < lib/client.js) bytes)"
