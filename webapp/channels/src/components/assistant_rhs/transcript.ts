// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type AssistantTranscriptMessage = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
};

const transcripts = new Map<string, AssistantTranscriptMessage[]>();

export function getTranscript(channelId: string): AssistantTranscriptMessage[] {
    return transcripts.get(channelId) ?? [];
}

export function appendTranscript(channelId: string, message: AssistantTranscriptMessage): AssistantTranscriptMessage[] {
    const next = [...getTranscript(channelId), message];
    transcripts.set(channelId, next);
    return next;
}

export function clearTranscripts() {
    transcripts.clear();
}
