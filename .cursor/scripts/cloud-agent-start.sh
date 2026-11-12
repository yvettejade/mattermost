#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[cloud-agent-start] %s\n' "$*" >&2
}

materialize_cloud_agent_instructions() {
  if [ -f .cursor/cursor.md ]; then
    cp .cursor/cursor.md .cursor/AGENTS.md
    log "Materialized Cloud Agent instructions at .cursor/AGENTS.md."
  fi
}

materialize_cloud_agent_instructions

if ! command -v docker >/dev/null 2>&1; then
  log "Docker CLI is missing. The Cloud Agent image did not build from .cursor/Dockerfile."
  exit 1
fi

ensure_docker_socket_access() {
  if [ ! -S /var/run/docker.sock ]; then
    return 0
  fi

  sudo groupadd -f docker
  sudo usermod -aG docker "$(id -un)"
  sudo chgrp docker /var/run/docker.sock >/dev/null 2>&1 || true
  sudo chmod g+rw /var/run/docker.sock >/dev/null 2>&1 || true

  if command -v setfacl >/dev/null 2>&1; then
    sudo setfacl -m "u:$(id -un):rw" /var/run/docker.sock >/dev/null 2>&1 || true
  fi
}


ensure_image() {
  local image="$1"
  local mirror="${2:-}"
  if docker image inspect "$image" >/dev/null 2>&1; then
    return 0
  fi
  if docker pull "$image"; then
    return 0
  fi
  if [ -n "$mirror" ] && docker pull "$mirror"; then
    docker tag "$mirror" "$image"
    log "Tagged $mirror as $image after Docker Hub pull failed."
    return 0
  fi
  log "Could not ensure image $image."
  return 1
}

ensure_wait_for_dep_image() {
  if docker image inspect mattermost/mattermost-wait-for-dep:latest >/dev/null 2>&1; then
    return 0
  fi
  local build_dir
  build_dir="$(mktemp -d)"
  cat >"$build_dir/wait-for-dep.sh" <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then
  echo "usage: wait-for-dep host:port ..." >&2
  exit 1
fi
for target in "${targets[@]}"; do
  host="${target%%:*}"
  port="${target##*:}"
  echo "waiting for $host:$port"
  for i in $(seq 1 60); do
    if (echo >"/dev/tcp/$host/$port") >/dev/null 2>&1; then
      echo "$host:$port is up"
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "timeout waiting for $host:$port" >&2
      exit 1
    fi
    sleep 1
  done
done
echo "all dependencies ready"
EOS
  cat >"$build_dir/Dockerfile" <<'EOF'
FROM public.ecr.aws/ubuntu/ubuntu:24.04
COPY wait-for-dep.sh /usr/local/bin/wait-for-dep.sh
RUN chmod +x /usr/local/bin/wait-for-dep.sh
ENTRYPOINT ["/usr/local/bin/wait-for-dep.sh"]
EOF
  if docker build -t mattermost/mattermost-wait-for-dep:latest "$build_dir"; then
    log "Built local mattermost/mattermost-wait-for-dep:latest fallback image."
  else
    log "Failed to build local wait-for-dep fallback image."
  fi
  rm -rf "$build_dir"
}

ensure_dev_images() {
  # Docker Hub blob CDN (s3 dualstack) is often blocked in Cloud Agents.
  # Prefer already-present images, then Hub, then public ECR library mirrors.
  ensure_image "postgres:14" "public.ecr.aws/docker/library/postgres:14" || true
  ensure_image "redis:7.4.0" "public.ecr.aws/docker/library/redis:7.4.0" || true
  ensure_wait_for_dep_image || true
}

docker_login_if_configured() {
  if [ -z "${DOCKERHUB_USERNAME:-}" ] || [ -z "${DOCKERHUB_TOKEN:-}" ]; then
    log "Docker Hub credentials not configured; anonymous pulls may hit rate limits."
    return 0
  fi

  log "Logging in to Docker Hub as ${DOCKERHUB_USERNAME}."
  if echo "${DOCKERHUB_TOKEN}" | docker login -u "${DOCKERHUB_USERNAME}" --password-stdin >/tmp/docker-login.log 2>&1; then
    log "Docker Hub login succeeded."
  else
    log "Docker Hub login failed; see /tmp/docker-login.log."
    tail -n 20 /tmp/docker-login.log >&2 || true
  fi
}

if [ -f /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]; then
  sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0 >/dev/null 2>&1 || \
    log "Could not relax AppArmor user namespace restriction; openldap-based tests may need a larger host profile."
fi

ensure_docker_socket_access

if docker info >/dev/null 2>&1; then
  log "Docker is already running."
  docker compose version
  docker_login_if_configured
  ensure_dev_images
  exit 0
fi

log "Starting Docker daemon."
if command -v service >/dev/null 2>&1; then
  sudo sh -c 'service docker start >/tmp/docker-service-start.log 2>&1' || \
    log "service docker start failed; falling back to direct dockerd startup."
fi

if ! pgrep -x dockerd >/dev/null 2>&1; then
  sudo sh -c 'nohup dockerd --host=unix:///var/run/docker.sock >/tmp/dockerd.log 2>&1 &'
fi

for _ in {1..60}; do
  ensure_docker_socket_access

  if docker info >/dev/null 2>&1; then
    log "Docker is ready."
    docker version
    docker compose version
    docker_login_if_configured
    ensure_dev_images
    exit 0
  fi

  sleep 1
done

log "Docker did not become ready within 60 seconds."
if [ -f /tmp/docker-service-start.log ]; then
  log "docker service output:"
  tail -n 80 /tmp/docker-service-start.log >&2 || true
fi
if [ -f /tmp/dockerd.log ]; then
  log "dockerd output:"
  tail -n 120 /tmp/dockerd.log >&2 || true
fi

exit 1
