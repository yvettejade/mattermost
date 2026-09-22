// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package conversations

import (
	"github.com/mattermost/mattermost-plugin-ai/bots"
	"github.com/mattermost/mattermost-plugin-ai/grounding"
	"github.com/mattermost/mattermost-plugin-ai/llm"
	"github.com/mattermost/mattermost-plugin-ai/prompts"
	"github.com/mattermost/mattermost/server/public/model"
)

func (c *Conversations) systemPromptName(bot *bots.Bot) string {
	if bots.IsMattermostBot(bot) {
		return prompts.PromptMattermostBotSystem
	}
	return prompts.PromptDirectMessageQuestionSystem
}

func (c *Conversations) retrieveGrounded(bot *bots.Bot, postingUser *model.User, channel *model.Channel, post *model.Post) ([]grounding.Source, error) {
	if c.retriever == nil || postingUser == nil {
		return nil, nil
	}
	botUserID := ""
	if bot.GetMMBot() != nil {
		botUserID = bot.GetMMBot().UserId
	}
	return c.retriever.Retrieve(postingUser.Id, botUserID, bot.GetConfig().Name, post, channel)
}

func applyGroundedSources(context *llm.Context, sources []grounding.Source) {
	if context == nil {
		return
	}
	if context.Parameters == nil {
		context.Parameters = map[string]interface{}{}
	}
	context.Parameters["Results"] = sources
}
