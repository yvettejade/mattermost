# Standalone plugin build. Match server/.go-version (Go 1.26.3) when practical.
PLUGIN_ID ?= com.yvette.grok-agent
PLUGIN_VERSION ?= 0.2.0
BUNDLE_NAME ?= $(PLUGIN_ID)-$(PLUGIN_VERSION).tar.gz

GO ?= go
NPM ?= npm
export CGO_ENABLED = 0

.PHONY: all
all: dist

.PHONY: server
server:
	mkdir -p server/dist
	cd server && GOOS=linux GOARCH=amd64 $(GO) build -o dist/plugin-linux-amd64 .
	cd server && GOOS=linux GOARCH=arm64 $(GO) build -o dist/plugin-linux-arm64 .
	cd server && GOOS=darwin GOARCH=amd64 $(GO) build -o dist/plugin-darwin-amd64 .
	cd server && GOOS=darwin GOARCH=arm64 $(GO) build -o dist/plugin-darwin-arm64 .
	cd server && GOOS=windows GOARCH=amd64 $(GO) build -o dist/plugin-windows-amd64.exe .

.PHONY: webapp
webapp:
	cd webapp && $(NPM) install && $(NPM) run build

.PHONY: dist
dist: server webapp
	rm -rf dist/bundle
	mkdir -p dist/bundle/$(PLUGIN_ID)/server dist/bundle/$(PLUGIN_ID)/webapp
	cp plugin.json dist/bundle/$(PLUGIN_ID)/
	cp -a server/dist dist/bundle/$(PLUGIN_ID)/server/
	cp -a webapp/dist dist/bundle/$(PLUGIN_ID)/webapp/
	if [ -d assets ]; then cp -a assets dist/bundle/$(PLUGIN_ID)/; fi
	tar -C dist/bundle -czf dist/$(BUNDLE_NAME) $(PLUGIN_ID)
	@echo "wrote dist/$(BUNDLE_NAME)"

.PHONY: test
test:
	$(GO) test ./...
	cd webapp && $(NPM) test -- --watchAll=false

.PHONY: clean
clean:
	rm -rf dist server/dist webapp/dist
