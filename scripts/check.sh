#!/usr/bin/env bash
# Validate the marketplace catalog and every plugin, and make sure each
# plugin's version matches its catalog entry. Run before opening a PR.
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
catalog=.claude-plugin/marketplace.json

echo "== marketplace catalog"
claude plugin validate "$catalog" || fail=1

for dir in plugins/*/; do
  [ -d "$dir" ] || continue
  name=$(basename "$dir")
  manifest="$dir.claude-plugin/plugin.json"
  echo "== plugin: $name"
  if [ ! -f "$manifest" ]; then
    echo "   MISSING $manifest"; fail=1; continue
  fi
  claude plugin validate "$dir" || fail=1

  plugin_version=$(jq -r .version "$manifest")
  catalog_version=$(jq -r --arg n "$name" '.plugins[] | select(.name == $n) | .version' "$catalog")
  catalog_path=$(jq -r --arg n "$name" '.plugins[] | select(.name == $n) | .source.path' "$catalog")

  if [ -z "$catalog_version" ]; then
    echo "   NOT IN CATALOG: add an entry for '$name' to $catalog"; fail=1
  elif [ "$plugin_version" != "$catalog_version" ]; then
    echo "   VERSION MISMATCH: plugin.json=$plugin_version catalog=$catalog_version"; fail=1
  else
    echo "   version $plugin_version OK"
  fi
  if [ -n "$catalog_version" ] && [ "$catalog_path" != "plugins/$name" ]; then
    echo "   PATH MISMATCH: catalog source.path=$catalog_path expected plugins/$name"; fail=1
  fi
done

echo "== catalog entries without a plugin directory"
for n in $(jq -r '.plugins[].name' "$catalog"); do
  [ -d "plugins/$n" ] || { echo "   '$n' listed but plugins/$n does not exist"; fail=1; }
done

if [ "$fail" -ne 0 ]; then echo; echo "FAILED"; exit 1; fi
echo; echo "All good."
