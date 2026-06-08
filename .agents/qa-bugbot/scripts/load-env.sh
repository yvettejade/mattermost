#!/usr/bin/env bash
# Source key=value pairs from .env into the current shell (no export of comments).
load_env_file() {
    local file="$1"
    [[ -f "$file" ]] || return 1
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line%%#*}"
        line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        [[ -z "$line" || "$line" != *=* ]] && continue
        local key="${line%%=*}"
        local value="${line#*=}"
        printf -v "$key" '%s' "$value"
        export "$key"
    done <"$file"
}
