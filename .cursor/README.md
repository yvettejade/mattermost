# Cursor Cloud Agent Environment

This directory defines the checked-in Cloud Agent environment for this repository. Cursor resolves `.cursor/environment.json` before personal or team saved environments, so this replaces the snapshot-dependent `/onboard` flow for agents started from this repo.

The Docker build context is `.cursor/` only. The Dockerfile intentionally does not copy the repository; Cursor checks out the requested commit at runtime.

## What Is Baked Into The Image

- Ubuntu 24.04 from `public.ecr.aws/ubuntu/ubuntu:24.04` (not Docker Hub; Cloud Agent builders have been failing to fetch `ubuntu:24.04` blobs from `docker-images-prod.s3.dualstack`).
- Docker CE 28.5.2 with `fuse-overlayfs` and `iptables-legacy`, matching Cursor's Docker-in-Cloud guidance for complex compose setups.
- Go 1.26.3 from `server/.go-version`, with `GOTOOLCHAIN=local` so install does not fetch toolchains from `go.dev` (not on the Cloud Agent allowlist).
- Node 24.11.1/npm 11 via nvm, matching `.nvmrc` and `webapp/package.json`.
- `agent-browser@0.27.0` and browser dependencies for screenshot workflows.
- AWS CLI v2 for S3 uploads.
- Common Mattermost build/test tools: `make`, `jq`, `xmlsec1`, `pgloader`, Git LFS, GitHub CLI, Python 3, and build essentials.

## Runtime Hooks

- `cloud-agent-install.sh` runs after Cursor checks out the repo. It refreshes nvm, installs agent-browser browsers, locates or clones `mattermost/enterprise` when the GitHub token can see it, runs `server` Go dependency hydration, installs webapp dependencies, and runs Playwright `npm ci`. Missing enterprise is a warning, not an install failure: environment builds only check out the primary repo.
- `cloud-agent-start.sh` materializes `.cursor/cursor.md` as `.cursor/AGENTS.md`, fixes current-session Docker socket access, starts Docker, waits until `docker info` and `docker compose version` succeed, then logs in to Docker Hub when credentials are configured.

The environment declares `github.com/mattermost/enterprise` in `repositoryDependencies` so the generated GitHub token can include that private repo. That field does not clone a sibling checkout during environment builds. When a live multi-repo agent does check enterprise out next to mattermost, `server/Makefile`'s default `../../enterprise` path still applies. Otherwise the install hook clones into `$HOME/enterprise` when `gh` can resolve the repo, and points `BUILD_ENTERPRISE_DIR` at that absolute path.

## Useful Skips

Set these environment variables to `true` to shorten startup for narrow tasks:

- `CLOUD_AGENT_SKIP_ENTERPRISE`
- `CLOUD_AGENT_SKIP_GO_DEPS`
- `CLOUD_AGENT_SKIP_WEBAPP_DEPS`
- `CLOUD_AGENT_SKIP_PLAYWRIGHT_DEPS`
- `CLOUD_AGENT_SKIP_AGENT_BROWSER_INSTALL`

## Expected Secrets

Configure these in the [Cursor Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents) as environment-scoped secrets for the Mattermost Cloud Agent environment.

- AWS uploads use the standard AWS CLI environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET_NAME`. The image only supplies the `aws` binary.
- Docker Hub pulls use the same variable names as CI: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`. The start hook runs `docker login` after `dockerd` is ready. Mark `DOCKERHUB_TOKEN` as **redacted** in the dashboard. When both are set, agents can pull the full default `make start-docker` image set without hitting anonymous rate limits.
