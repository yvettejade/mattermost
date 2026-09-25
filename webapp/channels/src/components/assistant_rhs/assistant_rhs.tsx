// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {ServerError} from '@mattermost/types/errors';

import {Client4} from 'mattermost-redux/client';
import {getCurrentChannel, getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {closeRightHandSide} from 'actions/views/rhs';

import Markdown from 'components/markdown';

import {appendTranscript, getTranscript} from './transcript';

import './assistant_rhs.scss';

function nextId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function AssistantRhs() {
    const intl = useIntl();
    const dispatch = useDispatch();
    const channelId = useSelector(getCurrentChannelId);
    const channel = useSelector(getCurrentChannel);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [messages, setMessages] = useState(() => getTranscript(channelId));
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMessages(getTranscript(channelId));
        setDraft('');
    }, [channelId]);

    useEffect(() => {
        listRef.current?.scrollTo({top: listRef.current.scrollHeight});
    }, [messages]);

    const handleClose = useCallback(() => {
        dispatch(closeRightHandSide());
    }, [dispatch]);

    const send = useCallback(async () => {
        const text = draft.trim();
        if (!text || !channelId || busy) {
            return;
        }

        const userMessage = {id: nextId('user'), role: 'user' as const, text};
        setMessages(appendTranscript(channelId, userMessage));
        setDraft('');
        setBusy(true);

        try {
            const reply = await Client4.askAssistant(channelId, {message: text, root_id: ''});
            setMessages(appendTranscript(channelId, {
                id: nextId('assistant'),
                role: 'assistant',
                text: reply.reply,
            }));
        } catch (e) {
            const err = e as ServerError;
            const fallback = intl.formatMessage({
                id: 'assistant_rhs.error',
                defaultMessage: 'The assistant could not complete that request.',
            });
            setMessages(appendTranscript(channelId, {
                id: nextId('assistant'),
                role: 'assistant',
                text: err?.message || fallback,
            }));
        } finally {
            setBusy(false);
        }
    }, [busy, channelId, draft, intl]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            send();
        }
    }, [send]);

    return (
        <div
            id='assistantRhs'
            className='AssistantRhs sidebar-right__body'
        >
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>
                    <h2>
                        <span id='rhsPanelTitle'>
                            <FormattedMessage
                                id='assistant_rhs.title'
                                defaultMessage='Assistant'
                            />
                        </span>
                        {channel?.display_name && (
                            <span className='style--none sidebar--right__title__subtitle'>
                                {channel.display_name}
                            </span>
                        )}
                    </h2>
                </span>
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='rhs_header.closeSidebarTooltip'
                            defaultMessage='Close'
                        />
                    }
                >
                    <button
                        id='rhsCloseButton'
                        type='button'
                        className='sidebar--right__close btn btn-icon btn-sm'
                        aria-label={intl.formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                        onClick={handleClose}
                    >
                        <i className='icon icon-close'/>
                    </button>
                </WithTooltip>
            </div>
            <div
                ref={listRef}
                className='AssistantRhs__messages'
            >
                {messages.length === 0 && (
                    <div className='AssistantRhs__empty'>
                        <FormattedMessage
                            id='assistant_rhs.empty'
                            defaultMessage='Ask for a summary, catch-up, or a question about this channel.'
                        />
                    </div>
                )}
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`AssistantRhs__message AssistantRhs__message--${message.role}`}
                    >
                        {message.role === 'assistant' ? (
                            <Markdown
                                message={message.text}
                                channelId={channelId}
                            />
                        ) : (
                            <div>{message.text}</div>
                        )}
                    </div>
                ))}
            </div>
            <form
                className='AssistantRhs__composer'
                onSubmit={(event) => {
                    event.preventDefault();
                    send();
                }}
            >
                <label
                    className='sr-only'
                    htmlFor='assistantRhsInput'
                >
                    <FormattedMessage
                        id='assistant_rhs.input'
                        defaultMessage='Message the assistant'
                    />
                </label>
                <textarea
                    id='assistantRhsInput'
                    value={draft}
                    disabled={busy || !channelId}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={intl.formatMessage({
                        id: 'assistant_rhs.placeholder',
                        defaultMessage: 'Ask Assistant',
                    })}
                    rows={3}
                />
                <button
                    type='submit'
                    className='btn btn-primary'
                    disabled={busy || !draft.trim() || !channelId}
                >
                    <FormattedMessage
                        id='assistant_rhs.send'
                        defaultMessage='Send'
                    />
                </button>
            </form>
        </div>
    );
}

export default AssistantRhs;
