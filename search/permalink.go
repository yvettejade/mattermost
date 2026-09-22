// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package search

import "strings"

// Permalink is the post URL Mattermost embeds as a permalink.
// Team name is the URL slug. Direct messages and group messages have no team,
// so those use the _redirect slug the citation prompt already documents.
func Permalink(siteURL, teamName, postID string) string {
	siteURL = strings.TrimRight(strings.TrimSpace(siteURL), "/")
	team := teamName
	if team == "" {
		team = "_redirect"
	}
	path := team + "/pl/" + postID + "?view=citation"
	if siteURL == "" {
		return "/" + path
	}
	return siteURL + "/" + path
}
