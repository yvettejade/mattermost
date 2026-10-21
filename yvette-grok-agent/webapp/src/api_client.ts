import {buildChatRequest, currentChatContext} from './modal_state';

export const PLUGIN_ID = 'com.yvette.grok-agent';

export type ChatCitation = {
    post_id: string;
    permalink: string;
};

export type ChatActionTaken = {
    type: string;
    status: string;
};

export type ChatResponse = {
    reply: string;
    citations?: ChatCitation[];
    actions_taken?: ChatActionTaken[];
};

export function chatURL() {
    return `/plugins/${PLUGIN_ID}/api/v1/chat`;
}

export async function postChat(message: string, fetchImpl: typeof fetch = fetch): Promise<ChatResponse> {
    const payload = buildChatRequest(message, currentChatContext());
    const res = await fetchImpl(chatURL(), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error(`chat request failed (${res.status})`);
    }
    return res.json();
}
