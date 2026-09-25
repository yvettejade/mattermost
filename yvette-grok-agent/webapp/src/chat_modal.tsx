import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useSelector} from 'react-redux';

import {fetchGrokStatus, queryGrok, type GrokStatus} from './client';
import {closeGrokModal, isGrokModalOpen, subscribeGrokModal} from './modal_state';

type Channel = {
    id: string;
    display_name?: string;
};

type RootState = {
    entities?: {
        channels?: {
            currentChannelId?: string;
            channels?: Record<string, Channel>;
        };
        teams?: {
            currentTeamId?: string;
        };
    };
    views?: {
        rhs?: {
            selectedPostId?: string;
        };
    };
};

type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    provider?: string;
    sources?: string[];
};

const QUICK_ACTIONS = [
    {intent: 'summarize', message: 'catch up', label: 'Catch up'},
    {intent: 'draft', message: 'draft a project update', label: 'Draft'},
    {intent: 'schedule', message: 'schedule a working session', label: 'Schedule'},
    {intent: 'canvas', message: 'canvas sprint goals', label: 'Canvas'},
    {intent: 'route', message: 'route specialist this thread', label: 'Route'},
    {intent: 'github', message: 'github', label: 'GitHub'},
    {intent: 'jira', message: 'jira', label: 'Jira'},
] as const;

export default function GrokChatModal() {
    const [open, setOpen] = useState(isGrokModalOpen);
    const channelId = useSelector((state: RootState) => state.entities?.channels?.currentChannelId);
    const channel = useSelector((state: RootState) => {
        const id = state.entities?.channels?.currentChannelId;
        return id ? state.entities?.channels?.channels?.[id] : undefined;
    });
    const teamId = useSelector((state: RootState) => state.entities?.teams?.currentTeamId);
    const selectedPostId = useSelector((state: RootState) => state.views?.rhs?.selectedPostId);

    const [status, setStatus] = useState<GrokStatus | null>(null);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const transcriptRef = useRef<HTMLDivElement>(null);
    const nextId = useRef(0);

    useEffect(() => subscribeGrokModal(() => setOpen(isGrokModalOpen())), []);

    useEffect(() => {
        if (!open) {
            return;
        }
        let cancelled = false;
        fetchGrokStatus().then((next) => {
            if (!cancelled) {
                setStatus(next);
            }
        }).catch(() => {
            if (!cancelled) {
                setStatus(null);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        const node = transcriptRef.current;
        if (node) {
            node.scrollTop = node.scrollHeight;
        }
    }, [messages, busy]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeGrokModal();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    const send = useCallback(async (message: string, intent?: string) => {
        const trimmed = message.trim();
        if (!trimmed || busy) {
            return;
        }
        if (!channelId) {
            setError('Open a channel first so Grok can read workspace history.');
            return;
        }

        const userMessage: ChatMessage = {
            id: `user-${nextId.current++}`,
            role: 'user',
            text: trimmed,
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setError(null);
        setBusy(true);

        try {
            const response = await queryGrok({
                text: trimmed,
                channel_id: channelId,
                root_id: selectedPostId,
                team_id: teamId,
                intent,
            });
            setMessages((prev) => [...prev, {
                id: `assistant-${nextId.current++}`,
                role: 'assistant',
                text: response.reply,
                provider: response.provider,
                sources: response.sources,
            }]);
        } catch {
            setError('Grok could not complete that request. Try again from a channel you can access.');
        } finally {
            setBusy(false);
        }
    }, [busy, channelId, selectedPostId, teamId]);

    if (!open) {
        return null;
    }

    const providerLabel = status?.provider === 'grok' ? 'Grok Chat' : 'Workspace history';

    return (
        <div
            className='YvetteGrokModal__backdrop'
            data-testid='grok-agent-modal'
            role='presentation'
            onClick={closeGrokModal}
        >
            <div
                className='YvetteGrokModal'
                role='dialog'
                aria-modal='true'
                aria-labelledby='yvetteGrokModalTitle'
                onClick={(event) => event.stopPropagation()}
            >
                <header className='YvetteGrokModal__header'>
                    <div>
                        <h2 id='yvetteGrokModalTitle'>{'Grok'}</h2>
                        <p className='YvetteGrokModal__subtitle'>
                            {'Ask about this workspace, then draft, schedule, or route work. Using '}
                            {providerLabel}
                            {'.'}
                        </p>
                    </div>
                    <button
                        type='button'
                        className='YvetteGrokModal__close'
                        aria-label='Close Grok'
                        onClick={closeGrokModal}
                    >
                        {'×'}
                    </button>
                </header>
                <div className='YvetteGrokModal__body'>
                    {channel?.display_name && (
                        <p className='YvetteGrokModal__context'>
                            {'Reading '}
                            {channel.display_name}
                            {selectedPostId ? ' and the open thread' : ''}
                            {'.'}
                        </p>
                    )}
                    <div
                        className='YvetteGrokModal__actions'
                        data-testid='grok-agent-actions'
                    >
                        {QUICK_ACTIONS.map((action) => (
                            <button
                                key={action.intent}
                                type='button'
                                className='YvetteGrokModal__chip'
                                disabled={busy}
                                data-testid={`grok-agent-action-${action.intent}`}
                                onClick={() => send(action.message, action.intent)}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                    <div
                        ref={transcriptRef}
                        className='YvetteGrokModal__transcript'
                        data-testid='grok-agent-transcript'
                    >
                        {messages.length === 0 && (
                            <p className='YvetteGrokModal__empty'>
                                {'Ask a question or pick an action. Answers stay grounded in Mattermost history plus GitHub and Jira when relevant.'}
                            </p>
                        )}
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`YvetteGrokModal__message YvetteGrokModal__message--${message.role}`}
                                data-testid={`grok-agent-message-${message.role}`}
                            >
                                <div className='YvetteGrokModal__messageText'>{message.text}</div>
                                {message.sources && message.sources.length > 0 && (
                                    <div className='YvetteGrokModal__sources'>
                                        {message.sources.join(' · ')}
                                    </div>
                                )}
                            </div>
                        ))}
                        {busy && (
                            <div
                                className='YvetteGrokModal__message YvetteGrokModal__message--assistant'
                                data-testid='grok-agent-pending'
                            >
                                {'Looking through the workspace…'}
                            </div>
                        )}
                    </div>
                    {error && (
                        <div
                            className='YvetteGrokModal__error'
                            data-testid='grok-agent-error'
                        >
                            {error}
                        </div>
                    )}
                </div>
                <form
                    className='YvetteGrokModal__composer'
                    onSubmit={(event) => {
                        event.preventDefault();
                        send(input);
                    }}
                >
                    <label
                        className='sr-only'
                        htmlFor='grokAgentInput'
                    >
                        {'Message Grok'}
                    </label>
                    <input
                        id='grokAgentInput'
                        data-testid='grok-agent-input'
                        className='YvetteGrokModal__input'
                        value={input}
                        disabled={busy}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder='Ask Grok to catch up, draft, or look up GitHub and Jira…'
                    />
                    <button
                        type='submit'
                        className='YvetteGrokModal__send'
                        disabled={busy || !input.trim()}
                        data-testid='grok-agent-send'
                    >
                        {'Send'}
                    </button>
                </form>
            </div>
        </div>
    );
}
