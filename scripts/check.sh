#!/usr/bin/env bash
# Validate the marketplace catalog and every plugin, make sure each plugin's
# version matches its catalog entry, and run any plugin's tests/ directory.
# Run before opening a PR.
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

  if [ -f "${dir}hooks/hooks.json" ]; then
    # Either command hooks ("hooks": {...}) or a hooks module ("modules": [path], relative to hooks/).
    if python3 -c '
import json, os, sys
p = sys.argv[1]
d = json.load(open(p))
if "modules" in d:
    m = d["modules"]
    assert isinstance(m, list) and m, "modules must be a non-empty list"
    for f in m:
        assert os.path.isfile(os.path.join(os.path.dirname(p), f)), f"module {f} not found"
else:
    assert isinstance(d.get("hooks"), dict), "top-level hooks key missing"
' "${dir}hooks/hooks.json"; then
      echo "   hooks.json OK"
    else
      echo "   INVALID hooks/hooks.json"; fail=1
    fi
  fi

  if [ -d "${dir}tests" ]; then
    echo "   tests"
    python3 -m unittest discover -s "${dir}tests" -q || fail=1
  fi

  # A hooks module's *.test.ts(x) files run under the engine's own test kit.
  if [ -n "$(find "$dir" -path "${dir}.claude-plugin" -prune -o -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) -print -quit)" ]; then
    echo "   plugin tests"
    if out=$(claude plugin test "$dir" 2>&1); then
      echo "   $(printf '%s\n' "$out" | grep -E '^ *[0-9]+ pass' | xargs)"
    else
      printf '%s\n' "$out" | grep -E '^\(fail\)|rror' ; echo "   PLUGIN TESTS FAILED"; fail=1
    fi
  fi

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
