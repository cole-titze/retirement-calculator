#!/bin/bash
# Points <tag> at exactly <digest> in ghcr.io by re-uploading the same manifest
# bytes, so the tag's digest is the one the build produced (a buildx/imagetools
# retag can rewrite the index). The nightly updater deploys whatever this tag names.
#
#   GHCR_USER=... GHCR_TOKEN=... promote.sh <owner/repo/image> <sha256:...> <tag>
set -euo pipefail

repo=${1:?image path, e.g. cole-titze/nhl-odds/webapi}
digest=${2:?digest}
tag=${3:?tag}
[[ $digest == sha256:* ]] || { echo "not a digest: $digest"; exit 1; }
accept="application/vnd.oci.image.index.v1+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.docker.distribution.manifest.v2+json"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

tok=$(curl -fsS -u "$GHCR_USER:$GHCR_TOKEN" "https://ghcr.io/token?scope=repository:$repo:pull,push" | jq -r .token)
curl -fsS -H "Authorization: Bearer $tok" -H "Accept: $accept" -D "$work/headers" -o "$work/manifest" \
  "https://ghcr.io/v2/$repo/manifests/$digest"
[ "sha256:$(sha256sum "$work/manifest" | cut -d' ' -f1)" = "$digest" ] || { echo "downloaded manifest doesn't match $digest"; exit 1; }
ctype=$(tr -d '\r' < "$work/headers" | awk -F': ' 'tolower($1) == "content-type" { print $2 }')

curl -fsS -X PUT -H "Authorization: Bearer $tok" -H "Content-Type: $ctype" --data-binary "@$work/manifest" \
  "https://ghcr.io/v2/$repo/manifests/$tag" >/dev/null
now=$(curl -fsSI -H "Authorization: Bearer $tok" -H "Accept: $accept" "https://ghcr.io/v2/$repo/manifests/$tag" \
  | tr -d '\r' | awk -F': ' 'tolower($1) == "docker-content-digest" { print $2 }')
[ "$now" = "$digest" ] || { echo "$repo:$tag is $now, expected $digest"; exit 1; }
echo "$repo:$tag -> $digest"
