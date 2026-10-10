#!/bin/sh
# Rebuild the client bundle, sync both entries into the installed profile copy,
# and trigger the running host's live recomposition.
set -eu
cd "$(dirname "$0")"
./build.sh
DEST="$HOME/.dsh/profiles/web/node_modules/dsh-ui-llm-memories"
cp --remove-destination lib/client.js lib/index.js package.json cordis.patch.yml "$DEST/"
# The host's HMR watches the profile manifest and patch files; a real content
# change recomposes reliably (an mtime-only touch does not always fire).
PATCH="$HOME/.dsh/profiles/web/cordis.patch.yml"
cp --remove-destination "$PATCH" "$PATCH.llm-memories-sync.bak"
printf '\n# llm-memories sync trigger\n' >> "$PATCH"
sleep 4
mv "$PATCH.llm-memories-sync.bak" "$PATCH"
echo "synced to profile and recomposed"
