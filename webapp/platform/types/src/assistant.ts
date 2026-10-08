// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type AssistantIntent =
    | 'summarize'
    | 'catch_up'
    | 'qa'
    | 'draft'
    | 'board'
    | 'schedule_meeting'
    | 'schedule_post'
    | 'jira';

export type AssistantActionType = 'scheduled_post' | 'board_channel' | 'card';

export type AssistantAsk = {
    message: string;
    root_id?: string;
};

export type AssistantAction = {
    type: AssistantActionType;
    id?: string;
    detail?: string;
};

export type AssistantReply = {
    reply: string;
    intent: AssistantIntent;
    actions?: AssistantAction[];
};
