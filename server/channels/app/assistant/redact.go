// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"os"
	"regexp"
	"strings"
)

// Env reads a process environment variable. Tests may replace getenv.
func Env(key string) string {
	return getenv(key)
}

var (
	getenv = os.Getenv

	bearerRE        = regexp.MustCompile(`(?i)(authorization:\s*bearer\s+)(\S+)`)
	bearerTokenRE   = regexp.MustCompile(`(?i)\bbearer\s+[A-Za-z0-9._\-+/=]{8,}`)
	headerSecretRE  = regexp.MustCompile(`(?i)(x-api-key:\s*)(\S+)`)
)

const redacted = "[REDACTED]"

// Redact removes known assistant secrets and Authorization material from s.
func Redact(s string) string {
	if s == "" {
		return s
	}
	for _, key := range []string{EnvGrokAPI, EnvJira} {
		if v := getenv(key); v != "" {
			s = strings.ReplaceAll(s, v, redacted)
		}
	}
	s = bearerRE.ReplaceAllString(s, "${1}"+redacted)
	s = bearerTokenRE.ReplaceAllString(s, "Bearer "+redacted)
	s = headerSecretRE.ReplaceAllString(s, "${1}"+redacted)
	return s
}
