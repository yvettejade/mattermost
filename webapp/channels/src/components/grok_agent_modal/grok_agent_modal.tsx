// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import {Button} from '@mattermost/shared/components/button';
import type {GrokAgentQueryResponse, GrokAgentStatus} from '@mattermost/types/grok_agent';

import {Client4} from 'mattermost-redux/client';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {getSelectedPostId} from 'selectors/rhs';

import ExternalLink from 'components/external_link';

import './grok_agent_modal.scss';

type Props = {
    onExited: () => void;
};

type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    provider?: string;
    sources?: string[];
    actions?: GrokAgentQueryResponse['actions'];
};

const QUICK_ACTIONS = [
    {intent: 'summarize', message: 'catch up', id: 'grok_agent.modal.catchUp', defaultMessage: 'Catch up'},
    {intent: 'draft', message: 'draft a project update', id: 'grok_agent.modal.draft', defaultMessage: 'Draft'},
    {intent: 'schedule', message: 'schedule a working session', id: 'grok_agent.modal.schedule', defaultMessage: 'Schedule'},
    {intent: 'canvas', message: 'build a canvas', id: 'grok_agent.modal.canvas', defaultMessage: 'Canvas'},
    {intent: 'route', message: 'route this to a specialist', id: 'grok_agent.modal.route', defaultMessage: 'Route'},
    {intent: 'github', message: 'github', id: 'grok_agent.modal.github', defaultMessage: 'GitHub'},
    {intent: 'jira', message: 'jira', id: 'grok_agent.modal.jira', defaultMessage: 'Jira'},
] as const;

const GrokAgentModal = ({onExited}: Props) => {
    const {formatMessage} = useIntl();
    const channel = useSelector(getCurrentChannel);
    const selectedPostId = useSelector(getSelectedPostId);
    const [status, setStatus] = useState<GrokAgentStatus | null>(null);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const transcriptRef = useRef<HTMLDivElement>(null);
    const nextId = useRef(0);

    useEffect(() => {
        let cancelled = false;
        Client4.getGrokAgentStatus().then((next) => {
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
    }, []);

    useEffect(() => {
        const node = transcriptRef.current;
        if (node) {
            node.scrollTop = node.scrollHeight;
        }
    }, [messages, busy]);

    const send = useCallback(async (message: string, intent?: string) => {
        const trimmed = message.trim();
        if (!trimmed || busy) {
            return;
        }
        if (!channel?.id) {
            setError(formatMessage({
                id: 'grok_agent.modal.noChannel',
                defaultMessage: 'Open a channel first so Grok can read workspace history.',
            }));
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
            const response = await Client4.queryGrokAgent({
                channel_id: channel.id,
                root_id: selectedPostId || undefined,
                message: trimmed,
                intent,
            });
            setMessages((prev) => [...prev, {
                id: `assistant-${nextId.current++}`,
                role: 'assistant',
                text: response.reply,
                provider: response.provider,
                sources: response.sources,
                actions: response.actions,
            }]);
        } catch (err) {
            setError(formatMessage({
                id: 'grok_agent.modal.error',
                defaultMessage: 'Grok could not complete that request. Try again from a channel you can access.',
            }));
        } finally {
            setBusy(false);
        }
    }, [busy, channel?.id, formatMessage, selectedPostId]);

    const handleSubmit = useCallback((event: React.FormEvent) => {
        event.preventDefault();
        send(input);
    }, [input, send]);

    const providerLabel = status?.provider === 'grok' ?
        formatMessage({id: 'grok_agent.modal.providerGrok', defaultMessage: 'Grok Chat'}) :
        formatMessage({id: 'grok_agent.modal.providerWorkspace', defaultMessage: 'Workspace history'});

    return (
        <GenericModal
            className='GrokAgentModal'
            id='grokAgentModal'
            dataTestId='grok-agent-modal'
            onExited={onExited}
            compassDesign={true}
            modalHeaderText={formatMessage({id: 'grok_agent.modal.title', defaultMessage: 'Grok'})}
            modalSubheaderText={formatMessage(
                {
                    id: 'grok_agent.modal.subtitle',
                    defaultMessage: 'Ask about this workspace, then draft, schedule, or route work. Using {provider}.',
                },
                {provider: providerLabel},
            )}
            bodyPadding={false}
            footerDivider={false}
            footerContent={(
                <form
                    className='GrokAgentModal__composer'
                    onSubmit={handleSubmit}
                >
                    <label
                        className='sr-only'
                        htmlFor='grokAgentInput'
                    >
                        <FormattedMessage
                            id='grok_agent.modal.inputLabel'
                            defaultMessage='Message Grok'
                        />
                    </label>
                    <input
                        id='grokAgentInput'
                        data-testid='grok-agent-input'
                        className='GrokAgentModal__input'
                        value={input}
                        disabled={busy}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder={formatMessage({
                            id: 'grok_agent.modal.placeholder',
                            defaultMessage: 'Ask Grok to catch up, draft, or look up GitHub and Jira…',
                        })}
                    />
                    <Button
                        type='submit'
                        disabled={busy || !input.trim()}
                        data-testid='grok-agent-send'
                    >
                        <FormattedMessage
                            id='grok_agent.modal.send'
                            defaultMessage='Send'
                        />
                    </Button>
                </form>
            )}
        >
            <div className='GrokAgentModal__body'>
                {channel?.display_name && (
                    <p className='GrokAgentModal__context'>
                        <FormattedMessage
                            id='grok_agent.modal.context'
                            defaultMessage='Reading {channel}{thread}.'
                            values={{
                                channel: channel.display_name,
                                thread: selectedPostId ? formatMessage({
                                    id: 'grok_agent.modal.threadSuffix',
                                    defaultMessage: ' and the open thread',
                                }) : '',
                            }}
                        />
                    </p>
                )}
                <div
                    className='GrokAgentModal__actions'
                    data-testid='grok-agent-actions'
                >
                    {QUICK_ACTIONS.map((action) => (
                        <button
                            key={action.intent}
                            type='button'
                            className='GrokAgentModal__chip'
                            disabled={busy}
                            data-testid={`grok-agent-action-${action.intent}`}
                            onClick={() => send(action.message, action.intent)}
                        >
                            <FormattedMessage
                                id={action.id}
                                defaultMessage={action.defaultMessage}
                            />
                        </button>
                    ))}
                </div>
                <div
                    ref={transcriptRef}
                    className='GrokAgentModal__transcript'
                    data-testid='grok-agent-transcript'
                >
                    {messages.length === 0 && (
                        <p className='GrokAgentModal__empty'>
                            <FormattedMessage
                                id='grok_agent.modal.empty'
                                defaultMessage='Ask a question or pick an action. Answers stay grounded in Mattermost history plus GitHub and Jira when relevant.'
                            />
                        </p>
                    )}
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`GrokAgentModal__message GrokAgentModal__message--${message.role}`}
                            data-testid={`grok-agent-message-${message.role}`}
                        >
                            <div className='GrokAgentModal__messageText'>{message.text}</div>
                            {message.sources && message.sources.length > 0 && (
                                <div className='GrokAgentModal__sources'>
                                    {message.sources.join(' · ')}
                                </div>
                            )}
                            {message.actions && message.actions.length > 0 && (
                                <div className='GrokAgentModal__resultActions'>
                                    {message.actions.map((item) => (
                                        item.payload?.startsWith('http') ? (
                                            <ExternalLink
                                                key={`${item.type}-${item.title}`}
                                                href={item.payload}
                                                location='grok_agent_modal'
                                            >
                                                {item.title}
                                            </ExternalLink>
                                        ) : (
                                            <span key={`${item.type}-${item.title}`}>{item.title}</span>
                                        )
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {busy && (
                        <div
                            className='GrokAgentModal__message GrokAgentModal__message--assistant'
                            data-testid='grok-agent-pending'
                        >
                            <FormattedMessage
                                id='grok_agent.modal.thinking'
                                defaultMessage='Looking through the workspace…'
                            />
                        </div>
                    )}
                </div>
                {error && (
                    <div
                        className='GrokAgentModal__error'
                        data-testid='grok-agent-error'
                    >
                        {error}
                    </div>
                )}
            </div>
        </GenericModal>
    );
};

export default GrokAgentModal;
