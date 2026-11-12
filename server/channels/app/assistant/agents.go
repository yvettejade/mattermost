// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"context"
	"sort"
	"strings"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
)

type AgentInput struct {
	Task    string
	Context *ContextBundle
	LLM     LLMClient
}

// Agent is a specialized handler the assistant can route tasks to. Agents receive only
// context that has already been permission-filtered for the requesting user.
type Agent interface {
	Name() string
	Description() string
	Run(ctx context.Context, in AgentInput) (string, error)
}

type AgentRegistry struct {
	mu     sync.RWMutex
	agents map[string]Agent
}

func NewAgentRegistry(agents ...Agent) *AgentRegistry {
	r := &AgentRegistry{agents: map[string]Agent{}}
	for _, a := range agents {
		r.Register(a)
	}
	return r
}

func (r *AgentRegistry) Register(a Agent) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.agents[a.Name()] = a
}

func (r *AgentRegistry) Get(name string) (Agent, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	a, ok := r.agents[name]
	return a, ok
}

func (r *AgentRegistry) List() []Agent {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]Agent, 0, len(r.agents))
	for _, a := range r.agents {
		list = append(list, a)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Name() < list[j].Name() })
	return list
}

func (r *AgentRegistry) Info() []*model.AssistantAgentInfo {
	agents := r.List()
	info := make([]*model.AssistantAgentInfo, 0, len(agents))
	for _, a := range agents {
		info = append(info, &model.AssistantAgentInfo{Name: a.Name(), Description: a.Description()})
	}
	return info
}

// DefaultAgents is the registry used by the server. Register additional agents at init time.
var DefaultAgents = NewAgentRegistry(&ActionItemsAgent{})

// ActionItemsAgent extracts owners, tasks and due dates from the conversation in context.
type ActionItemsAgent struct{}

func (*ActionItemsAgent) Name() string { return "action_items" }

func (*ActionItemsAgent) Description() string {
	return "extracts a checklist of action items (owner, task, due date) from the current channel or thread"
}

const actionItemsPrompt = `You are the action_items agent inside Mattermost.
Extract concrete action items from the CONTEXT posts only.
Output a Markdown checklist, one item per line, formatted as:
- [ ] @owner — task (due: date) [n]
Use "unassigned" when no owner is stated and omit "(due: ...)" when no date is stated.
Cite the supporting post number [n] for every item.
If the context contains no action items, reply exactly: "No action items found in the provided context."`

func (*ActionItemsAgent) Run(ctx context.Context, in AgentInput) (string, error) {
	msg, err := in.LLM.Complete(ctx, CompletionRequest{
		Messages: []ChatMessage{
			{Role: "system", Content: actionItemsPrompt},
			{Role: "system", Content: FormatContext(in.Context)},
			{Role: "user", Content: in.Task},
		},
		Temperature: 0.1,
	})
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(msg.Content), nil
}
