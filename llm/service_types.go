// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package llm

const (
	ServiceTypeOpenAI           = "openai"
	ServiceTypeOpenAICompatible = "openaicompatible"
	ServiceTypeAzure            = "azure"
	ServiceTypeASage            = "asage"
	ServiceTypeAnthropic        = "anthropic"
	ServiceTypeCohere           = "cohere"
	ServiceTypeBedrock          = "bedrock"
	ServiceTypeMistral          = "mistral"
	ServiceTypeScale            = "scale"
	// ServiceTypeXAI is xAI's OpenAI-compatible chat API. The API key is not stored
	// on the service; bots.ResolveServiceAPIKey reads YvetteGrokAPI at runtime.
	ServiceTypeXAI = "xai"

	// GrokModelID is the chat model id from xAI's current docs (Grok 4.6).
	// It is served from https://api.x.ai/v1 on both Chat Completions and the Responses API.
	// Chat Completions is what this plugin's OpenAI-compatible client speaks unless
	// UseResponsesAPI is set, and Grok 4.6 still documents that endpoint.
	GrokModelID = "grok-4.6"
	GrokAPIURL  = "https://api.x.ai/v1"
)
