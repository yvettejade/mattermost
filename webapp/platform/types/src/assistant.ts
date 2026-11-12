// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from './posts';

export type AssistantMode = 'ask' | 'summarize_thread' | 'summarize_unread' | 'summarize_recent';

export type AssistantActionType = 'draft_document' | 'create_post' | 'schedule_meeting' | 'create_canvas' | 'route_to_agent';

export type AssistantMessage = {
    role: 'user' | 'assistant';
    content: string;
};

export type AssistantChatRequest = {
    message: string;
    history?: AssistantMessage[];
    mode?: AssistantMode;
    channel_id?: string;
    root_id?: string;
};

export type AssistantCitation = {
    index: number;
    post_id: string;
    channel_id: string;
    channel_name: string;
    channel_display_name: string;
    team_name?: string;
    username?: string;
    create_at: number;
    snippet: string;
    permalink: string;
};

export type AssistantAction = {
    id: string;
    type: AssistantActionType;
    title: string;
    channel_id?: string;
    channel_display_name?: string;
    args: Record<string, unknown>;
    preview?: string;
};

export type AssistantChatResponse = {
    message: AssistantMessage;
    citations: AssistantCitation[];
    actions: AssistantAction[];
};

export type AssistantExecuteActionRequest = {
    type: AssistantActionType;
    args: Record<string, unknown>;
};

export type AssistantExecuteActionResponse = {
    post?: Post;
    content?: string;
};

export type AssistantAgentInfo = {
    name: string;
    description: string;
};

export type AssistantStatus = {
    configured: boolean;
    agents: AssistantAgentInfo[];
};
