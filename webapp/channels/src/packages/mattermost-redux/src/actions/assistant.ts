// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AssistantChatRequest, AssistantExecuteActionRequest} from '@mattermost/types/assistant';

import {bindClientFunc} from './helpers';

import {Client4} from '../client';

// Conversation state is intentionally kept in the assistant modal rather than in Redux:
// it is ephemeral and only meaningful while the modal is open.

export function getAssistantStatus() {
    return bindClientFunc({
        clientFunc: Client4.getAssistantStatus,
    });
}

export function sendAssistantMessage(request: AssistantChatRequest) {
    return bindClientFunc({
        clientFunc: Client4.assistantChat,
        params: [request],
    });
}

export function executeAssistantAction(request: AssistantExecuteActionRequest) {
    return bindClientFunc({
        clientFunc: Client4.executeAssistantAction,
        params: [request],
    });
}
