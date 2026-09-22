// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package search

import "testing"

func TestPermalink(t *testing.T) {
	got := Permalink("https://chat.example.com/", "engineering", "abc123def456ghij789klmno01")
	want := "https://chat.example.com/engineering/pl/abc123def456ghij789klmno01?view=citation"
	if got != want {
		t.Fatalf("Permalink() = %q, want %q", got, want)
	}

	dm := Permalink("https://chat.example.com", "", "abc123def456ghij789klmno01")
	wantDM := "https://chat.example.com/_redirect/pl/abc123def456ghij789klmno01?view=citation"
	if dm != wantDM {
		t.Fatalf("Permalink() DM = %q, want %q", dm, wantDM)
	}

	relative := Permalink("", "engineering", "abc123def456ghij789klmno01")
	if relative != "/engineering/pl/abc123def456ghij789klmno01?view=citation" {
		t.Fatalf("Permalink() relative = %q", relative)
	}
}
