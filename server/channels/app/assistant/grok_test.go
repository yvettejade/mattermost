// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultCompleteMissingKey(t *testing.T) {
	origGetenv := getenv
	origClient := grokHTTPClient
	t.Cleanup(func() {
		getenv = origGetenv
		grokHTTPClient = origClient
	})

	getenv = func(string) string { return "" }
	called := false
	grokHTTPClient = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		called = true
		return nil, io.EOF
	})}

	_, err := DefaultComplete(context.Background(), "sys", "user")
	require.NotNil(t, err)
	assert.Equal(t, http.StatusNotImplemented, err.StatusCode)
	assert.Equal(t, "api.assistant.config_missing", err.Id)
	assert.False(t, called)
	assert.NotContains(t, err.Error(), "xai-")
	assert.NotContains(t, err.DetailedError, "xai-")
}

func TestDefaultCompletePerRequestEnvAndFallback(t *testing.T) {
	origGetenv := getenv
	origClient := grokHTTPClient
	t.Cleanup(func() {
		getenv = origGetenv
		grokHTTPClient = origClient
	})

	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		assert.Equal(t, "Bearer secret-grok-key", r.Header.Get("Authorization"))
		var req grokRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		switch req.Model {
		case "grok-4":
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":"no grok-4"}`))
		case "grok-3":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"ok from grok-3"}}]}`))
		default:
			t.Fatalf("unexpected model %s", req.Model)
		}
	}))
	t.Cleanup(server.Close)

	getenv = func(key string) string {
		if key == EnvGrokAPI {
			return "secret-grok-key"
		}
		return ""
	}
	grokHTTPClient = server.Client()

	grokHTTPClient = &http.Client{Transport: rewriteHost(server.URL)}

	text, err := DefaultComplete(context.Background(), "sys", "user")
	require.Nil(t, err)
	assert.Equal(t, "ok from grok-3", text)
	assert.Equal(t, int32(2), calls.Load())
}

func TestDefaultCompleteDoesNotLeakSecret(t *testing.T) {
	origGetenv := getenv
	origClient := grokHTTPClient
	t.Cleanup(func() {
		getenv = origGetenv
		grokHTTPClient = origClient
	})

	getenv = func(key string) string {
		if key == EnvGrokAPI {
			return "super-secret-key-value"
		}
		return ""
	}
	grokHTTPClient = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, io.EOF
	})}

	_, err := DefaultComplete(context.Background(), "sys", "user")
	require.NotNil(t, err)
	assert.NotContains(t, err.Error(), "super-secret-key-value")
	assert.NotContains(t, err.DetailedError, "super-secret-key-value")
	assert.NotContains(t, err.Message, "super-secret-key-value")
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func rewriteHost(target string) http.RoundTripper {
	return roundTripFunc(func(r *http.Request) (*http.Response, error) {
		dest, err := url.Parse(target)
		if err != nil {
			return nil, err
		}
		clone := r.Clone(r.Context())
		clone.URL.Scheme = dest.Scheme
		clone.URL.Host = dest.Host
		clone.Host = dest.Host
		clone.RequestURI = ""
		return http.DefaultTransport.RoundTrip(clone)
	})
}
