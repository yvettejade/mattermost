// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

var ErrInvalidAction = errors.New("invalid assistant action")

type DraftDocumentArgs struct {
	Title     string `json:"title"`
	Content   string `json:"content"`
	ChannelId string `json:"channel_id,omitempty"`
}

type CreatePostArgs struct {
	ChannelId string `json:"channel_id"`
	RootId    string `json:"root_id,omitempty"`
	Message   string `json:"message"`
}

type ScheduleMeetingArgs struct {
	ChannelId       string   `json:"channel_id"`
	Title           string   `json:"title"`
	StartTime       string   `json:"start_time"`
	DurationMinutes int      `json:"duration_minutes"`
	Attendees       []string `json:"attendees,omitempty"`
	Agenda          []string `json:"agenda,omitempty"`
	Notes           string   `json:"notes,omitempty"`
}

type CanvasSection struct {
	Heading string `json:"heading"`
	Body    string `json:"body"`
}

type CanvasArgs struct {
	ChannelId string          `json:"channel_id"`
	Title     string          `json:"title"`
	Sections  []CanvasSection `json:"sections"`
	Pin       bool            `json:"pin"`
}

type RouteToAgentArgs struct {
	Agent     string `json:"agent"`
	Task      string `json:"task"`
	ChannelId string `json:"channel_id,omitempty"`
	RootId    string `json:"root_id,omitempty"`
}

// PostPlan is a fully rendered post. Its Message is exactly what the user previewed.
type PostPlan struct {
	ChannelId string
	RootId    string
	Message   string
	Pin       bool
}

type ActionPlan struct {
	Post  *PostPlan
	Agent *RouteToAgentArgs
}

func obj(props map[string]any, required ...string) map[string]any {
	return map[string]any{"type": "object", "properties": props, "required": required}
}

func str(desc string) map[string]any { return map[string]any{"type": "string", "description": desc} }

func fn(name, desc string, params map[string]any) Tool {
	return Tool{Type: "function", Function: ToolFunction{Name: name, Description: desc, Parameters: params}}
}

func Tools(agents []Agent) []Tool {
	channelDesc := "ID of the channel to post in. Defaults to the user's current channel."
	tools := []Tool{
		fn(model.AssistantActionDraftDocument,
			"Draft a markdown document (spec, notes, announcement, FAQ...). The user can copy it or post it after confirming.",
			obj(map[string]any{
				"title":      str("Document title."),
				"content":    str("Full document body in Markdown."),
				"channel_id": str(channelDesc),
			}, "title", "content")),
		fn(model.AssistantActionCreatePost,
			"Propose a message or thread reply to be posted as the user. It is only posted after the user confirms.",
			obj(map[string]any{
				"channel_id": str(channelDesc),
				"root_id":    str("Post ID of the thread root when replying in a thread."),
				"message":    str("Message text in Markdown."),
			}, "message")),
		fn(model.AssistantActionScheduleMeeting,
			"Propose a meeting: posts a formatted meeting proposal/invite in a channel after the user confirms. No calendar integration.",
			obj(map[string]any{
				"channel_id":       str(channelDesc),
				"title":            str("Meeting title."),
				"start_time":       str("Proposed start time in ISO 8601 (e.g. 2026-11-13T15:00:00Z), or a human description if unknown."),
				"duration_minutes": map[string]any{"type": "integer", "description": "Duration in minutes."},
				"attendees":        map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Usernames to invite, without @."},
				"agenda":           map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Agenda items."},
				"notes":            str("Optional extra notes."),
			}, "title", "start_time")),
		fn(model.AssistantActionCreateCanvas,
			"Build a canvas: a structured, formatted reference post (headings and sections) that is optionally pinned to the channel, after the user confirms.",
			obj(map[string]any{
				"channel_id": str(channelDesc),
				"title":      str("Canvas title."),
				"sections": map[string]any{"type": "array", "items": obj(map[string]any{
					"heading": str("Section heading."),
					"body":    str("Section body in Markdown."),
				}, "heading", "body")},
				"pin": map[string]any{"type": "boolean", "description": "Pin the canvas to the channel. Defaults to true."},
			}, "title", "sections")),
	}

	if len(agents) > 0 {
		names := make([]any, 0, len(agents))
		descs := make([]string, 0, len(agents))
		for _, a := range agents {
			names = append(names, a.Name())
			descs = append(descs, fmt.Sprintf("%s: %s", a.Name(), a.Description()))
		}
		tools = append(tools, fn(model.AssistantActionRouteToAgent,
			"Hand a task to a specialized agent. Available agents: "+strings.Join(descs, "; ")+".",
			obj(map[string]any{
				"agent": map[string]any{"type": "string", "enum": names, "description": "Agent name."},
				"task":  str("What the agent should do."),
			}, "agent", "task")))
	}
	return tools
}

// ProposeAction converts a model tool call into an action proposal; nothing is executed.
func ProposeAction(call ToolCall, defaultChannelID, defaultRootID string) (*model.AssistantAction, error) {
	raw := []byte(call.Function.Arguments)
	if strings.TrimSpace(call.Function.Arguments) == "" {
		raw = []byte("{}")
	}

	var (
		args      any
		title     string
		channelID string
	)
	switch call.Function.Name {
	case model.AssistantActionDraftDocument:
		a := &DraftDocumentArgs{}
		if err := json.Unmarshal(raw, a); err != nil {
			return nil, ErrInvalidAction
		}
		if a.ChannelId == "" {
			a.ChannelId = defaultChannelID
		}
		args, title, channelID = a, "Draft document: "+a.Title, a.ChannelId
	case model.AssistantActionCreatePost:
		a := &CreatePostArgs{}
		if err := json.Unmarshal(raw, a); err != nil {
			return nil, ErrInvalidAction
		}
		if a.ChannelId == "" {
			a.ChannelId = defaultChannelID
			if a.RootId == "" {
				a.RootId = defaultRootID
			}
		}
		title = "Post a message"
		if a.RootId != "" {
			title = "Reply in thread"
		}
		args, channelID = a, a.ChannelId
	case model.AssistantActionScheduleMeeting:
		a := &ScheduleMeetingArgs{}
		if err := json.Unmarshal(raw, a); err != nil {
			return nil, ErrInvalidAction
		}
		if a.ChannelId == "" {
			a.ChannelId = defaultChannelID
		}
		args, title, channelID = a, "Propose meeting: "+a.Title, a.ChannelId
	case model.AssistantActionCreateCanvas:
		a := &CanvasArgs{Pin: true}
		if err := json.Unmarshal(raw, a); err != nil {
			return nil, ErrInvalidAction
		}
		if a.ChannelId == "" {
			a.ChannelId = defaultChannelID
		}
		args, title, channelID = a, "Create canvas: "+a.Title, a.ChannelId
	case model.AssistantActionRouteToAgent:
		a := &RouteToAgentArgs{}
		if err := json.Unmarshal(raw, a); err != nil {
			return nil, ErrInvalidAction
		}
		a.ChannelId, a.RootId = defaultChannelID, defaultRootID
		args, title, channelID = a, "Ask the "+a.Agent+" agent", a.ChannelId
	default:
		return nil, ErrInvalidAction
	}

	encoded, err := json.Marshal(args)
	if err != nil {
		return nil, ErrInvalidAction
	}
	action := &model.AssistantAction{
		Id:        call.ID,
		Type:      call.Function.Name,
		Title:     strings.TrimSpace(title),
		ChannelId: channelID,
		Args:      encoded,
	}
	if action.Id == "" {
		action.Id = model.NewId()
	}

	plan, err := PlanAction(action.Type, action.Args)
	if err != nil {
		return nil, err
	}
	switch {
	case plan.Post != nil:
		action.Preview = plan.Post.Message
	case plan.Agent != nil:
		action.Preview = plan.Agent.Task
	}
	return action, nil
}

// PlanAction validates confirmed action arguments and renders the content to post.
func PlanAction(actionType string, raw json.RawMessage) (*ActionPlan, error) {
	if len(raw) == 0 {
		return nil, ErrInvalidAction
	}
	switch actionType {
	case model.AssistantActionDraftDocument:
		var a DraftDocumentArgs
		if err := json.Unmarshal(raw, &a); err != nil || strings.TrimSpace(a.Content) == "" {
			return nil, ErrInvalidAction
		}
		msg := strings.TrimSpace(a.Content)
		if t := strings.TrimSpace(a.Title); t != "" && !strings.HasPrefix(msg, "#") {
			msg = "# " + t + "\n\n" + msg
		}
		return &ActionPlan{Post: &PostPlan{ChannelId: a.ChannelId, Message: msg}}, nil

	case model.AssistantActionCreatePost:
		var a CreatePostArgs
		if err := json.Unmarshal(raw, &a); err != nil || strings.TrimSpace(a.Message) == "" {
			return nil, ErrInvalidAction
		}
		return &ActionPlan{Post: &PostPlan{ChannelId: a.ChannelId, RootId: a.RootId, Message: strings.TrimSpace(a.Message)}}, nil

	case model.AssistantActionScheduleMeeting:
		var a ScheduleMeetingArgs
		if err := json.Unmarshal(raw, &a); err != nil || strings.TrimSpace(a.Title) == "" {
			return nil, ErrInvalidAction
		}
		return &ActionPlan{Post: &PostPlan{ChannelId: a.ChannelId, Message: RenderMeeting(&a)}}, nil

	case model.AssistantActionCreateCanvas:
		var a CanvasArgs
		if err := json.Unmarshal(raw, &a); err != nil || strings.TrimSpace(a.Title) == "" || len(a.Sections) == 0 {
			return nil, ErrInvalidAction
		}
		return &ActionPlan{Post: &PostPlan{ChannelId: a.ChannelId, Message: RenderCanvas(&a), Pin: a.Pin}}, nil

	case model.AssistantActionRouteToAgent:
		var a RouteToAgentArgs
		if err := json.Unmarshal(raw, &a); err != nil || a.Agent == "" || strings.TrimSpace(a.Task) == "" {
			return nil, ErrInvalidAction
		}
		return &ActionPlan{Agent: &a}, nil
	}
	return nil, ErrInvalidAction
}

func RenderMeeting(a *ScheduleMeetingArgs) string {
	var b strings.Builder
	fmt.Fprintf(&b, "#### :calendar: Meeting proposal: %s\n\n", strings.TrimSpace(a.Title))
	when := strings.TrimSpace(a.StartTime)
	if t, err := time.Parse(time.RFC3339, when); err == nil {
		when = t.UTC().Format("Mon Jan 2, 2006 15:04 MST")
	}
	if when != "" {
		fmt.Fprintf(&b, "**When:** %s\n", when)
	}
	if a.DurationMinutes > 0 {
		fmt.Fprintf(&b, "**Duration:** %d minutes\n", a.DurationMinutes)
	}
	if len(a.Attendees) > 0 {
		mentions := make([]string, 0, len(a.Attendees))
		for _, u := range a.Attendees {
			if u = strings.TrimPrefix(strings.TrimSpace(u), "@"); u != "" {
				mentions = append(mentions, "@"+u)
			}
		}
		fmt.Fprintf(&b, "**Attendees:** %s\n", strings.Join(mentions, ", "))
	}
	if len(a.Agenda) > 0 {
		b.WriteString("\n**Agenda**\n")
		for _, item := range a.Agenda {
			fmt.Fprintf(&b, "- %s\n", strings.TrimSpace(item))
		}
	}
	if n := strings.TrimSpace(a.Notes); n != "" {
		fmt.Fprintf(&b, "\n%s\n", n)
	}
	b.WriteString("\nReact with :white_check_mark: if you can attend or :x: if you can't.")
	return b.String()
}

func RenderCanvas(a *CanvasArgs) string {
	var b strings.Builder
	fmt.Fprintf(&b, "### :memo: %s\n", strings.TrimSpace(a.Title))
	for _, s := range a.Sections {
		fmt.Fprintf(&b, "\n#### %s\n%s\n", strings.TrimSpace(s.Heading), strings.TrimSpace(s.Body))
	}
	return strings.TrimRight(b.String(), "\n")
}
