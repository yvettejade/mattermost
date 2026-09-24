PLUGIN_ID ?= com.mattermost.yvette-grok-agent
GO ?= go

.PHONY: test
test:
	$(GO) test ./server -count=1

.PHONY: build
build:
	mkdir -p server/dist
	cd server && $(GO) build -o dist/plugin-$$(go env GOOS)-$$(go env GOARCH) .

.PHONY: dist
dist: build
	rm -rf dist
	mkdir -p dist/$(PLUGIN_ID)/server/dist
	cp plugin.json dist/$(PLUGIN_ID)/
	cp server/dist/plugin-* dist/$(PLUGIN_ID)/server/dist/ 2>/dev/null || true
	cd dist && tar -czf $(PLUGIN_ID).tar.gz $(PLUGIN_ID)
