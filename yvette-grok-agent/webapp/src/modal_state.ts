export type ChatContext = {
    team_id: string;
    channel_id: string;
    root_id: string;
};

type Listener = (open: boolean) => void;

const listeners = new Set<Listener>();
let open = false;
let store: {getState: () => any} | null = null;

export function setPluginStore(next: {getState: () => any} | null) {
    store = next;
}

export function currentChatContext(): ChatContext {
    const state = store?.getState?.() ?? {};
    const entities = state.entities ?? {};
    return {
        team_id: entities.teams?.currentTeamId || '',
        channel_id: entities.channels?.currentChannelId || '',
        root_id: '',
    };
}

export function isChatOpen() {
    return open;
}

export function openChatModal() {
    open = true;
    listeners.forEach((fn) => fn(true));
}

export function closeChatModal() {
    open = false;
    listeners.forEach((fn) => fn(false));
}

export function subscribeChatModal(fn: Listener) {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}

export function buildChatRequest(message: string, ctx: ChatContext) {
    return {
        message,
        team_id: ctx.team_id,
        channel_id: ctx.channel_id,
        root_id: ctx.root_id || '',
    };
}
