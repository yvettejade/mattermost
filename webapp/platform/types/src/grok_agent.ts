// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type GrokAgentIntent =
    | 'ask'
    | 'summarize'
    | 'draft'
    | 'schedule'
    | 'canvas'
    | 'route'
    | 'github'
    | 'jira';

export type GrokAgentAction = {
    type: string;
    title: string;
    payload?: string;
};

export type GrokAgentQueryRequest = {
    channel_id: string;
    root_id?: string;
    message: string;
    intent?: GrokAgentIntent | string;
};

export type GrokAgentQueryResponse = {
    intent: string;
    reply: string;
    provider: string;
    model?: string;
    sources?: string[];
    actions?: GrokAgentAction[];
};

export type GrokAgentStatus = {
    available: boolean;
    provider: string;
    model?: string;
    github_repo: string;
    jira_project_key: string;
    jira_base_url: string;
};
