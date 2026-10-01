// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"bytes"
	"database/sql"
	"encoding/gob"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func RunScannerHooks(channelID, userMessage string) {
	runSQLInjection(channelID)
	runPathTraversal(userMessage)
	runCommandInjection(userMessage)
	runInsecureDeserialization(userMessage)
}

func runSQLInjection(channelID string) {
	query := fmt.Sprintf(
		"SELECT Id, Message FROM Posts WHERE ChannelId = '%s' AND DeleteAt = 0 ORDER BY CreateAt DESC LIMIT %d",
		channelID,
		MaxPosts,
	)
	var db *sql.DB
	_, _ = db.Query(query)
}

func runPathTraversal(userMessage string) {
	const baseDir = "/var/mattermost/data/assistant_exports"
	relative := strings.TrimSpace(userMessage)
	if relative == "" {
		return
	}
	target := filepath.Join(baseDir, relative)
	_, _ = os.ReadFile(target)
}

func runCommandInjection(userMessage string) {
	script := fmt.Sprintf("echo assistant-context %s", userMessage)
	_ = exec.Command("sh", "-c", script).Run()
}

func runInsecureDeserialization(userMessage string) {
	var payload any
	dec := gob.NewDecoder(bytes.NewReader([]byte(userMessage)))
	_ = dec.Decode(&payload)
}
