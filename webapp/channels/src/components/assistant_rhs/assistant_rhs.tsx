// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Channel} from '@mattermost/types/channels';

import {Client4} from 'mattermost-redux/client';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import Markdown from 'components/markdown';

import './assistant_rhs.scss';

export type AssistantTurn = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
};

const transcripts = new Map<string, AssistantTurn[]>();

export function getAssistantTranscript(channelId: string): AssistantTurn[] {
    return transcripts.get(channelId) ?? [];
}

export function clearAssistantTranscripts() {
    transcripts.clear();
}

type Props = {
    channel: Channel;
    onClose: () => void;
};

const AssistantRhs = ({channel, onClose}: Props) => {
    const {formatMessage} = useIntl();
    const team = useSelector(getCurrentTeam);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [turns, setTurns] = useState<AssistantTurn[]>(() => getAssistantTranscript(channel.id));
    const bottomRef = useRef<HTMLDivElement>(null);
    const channelIdRef = useRef(channel.id);
    channelIdRef.current = channel.id;

    useEffect(() => {
        setTurns(getAssistantTranscript(channel.id));
        setDraft('');
        setSending(false);
    }, [channel.id]);

    useEffect(() => {
        if (typeof bottomRef.current?.scrollIntoView === 'function') {
            bottomRef.current.scrollIntoView({block: 'nearest'});
        }
    }, [turns, sending]);

    const send = async () => {
        const message = draft.trim();
        if (!message || sending) {
            return;
        }
        const channelId = channel.id;
        const userTurn: AssistantTurn = {id: `${Date.now()}-user`, role: 'user', text: message};
        const next = [...getAssistantTranscript(channelId), userTurn];
        transcripts.set(channelId, next);
        setTurns(next);
        setDraft('');
        setSending(true);

        let reply = formatMessage({
            id: 'assistant_rhs.failed',
            defaultMessage: 'Assistant could not answer. Try again.',
        });
        try {
            const result = await Client4.askAssistant(channelId, message, '', team?.id || '');
            if (result?.reply) {
                reply = result.reply;
            }
        } catch (err) {
            const messageText = err instanceof Error ? err.message : '';
            if (messageText) {
                reply = messageText;
            }
        }

        const assistantTurn: AssistantTurn = {id: `${Date.now()}-assistant`, role: 'assistant', text: reply};
        const saved = [...getAssistantTranscript(channelId), assistantTurn];
        transcripts.set(channelId, saved);
        if (channelIdRef.current === channelId) {
            setTurns(saved);
            setSending(false);
        }
    };

    const onSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        send();
    };

    const title = formatMessage({id: 'assistant_rhs.title', defaultMessage: 'Assistant'});

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body assistant-rhs'
            role='region'
            aria-label={title}
        >
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>
                    <h2 id='rhsPanelTitle'>
                        {title}
                        {channel.display_name && (
                            <span className='style--none sidebar--right__title__subtitle'>
                                {channel.display_name}
                            </span>
                        )}
                    </h2>
                </span>
                <WithTooltip
                    title={formatMessage({id: 'rhs_header.closeSidebarTooltip', defaultMessage: 'Close'})}
                >
                    <button
                        id='rhsCloseButton'
                        type='button'
                        className='sidebar--right__close btn btn-icon btn-sm'
                        aria-label={formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                        onClick={onClose}
                    >
                        <i className='icon icon-close'/>
                    </button>
                </WithTooltip>
            </div>
            <div className='assistant-rhs__transcript'>
                {turns.length === 0 && !sending && (
                    <p className='assistant-rhs__empty'>
                        {formatMessage({
                            id: 'assistant_rhs.empty',
                            defaultMessage: 'Ask for a summary, a catch-up, a draft, or a meeting time. Answers use posts you can read in this channel.',
                        })}
                    </p>
                )}
                {turns.map((turn) => (
                    <div
                        key={turn.id}
                        className={`assistant-rhs__turn assistant-rhs__turn--${turn.role}`}
                    >
                        <div className='assistant-rhs__author'>
                            {turn.role === 'user' ? formatMessage({id: 'assistant_rhs.you', defaultMessage: 'You'}) : title}
                        </div>
                        <div className={`assistant-rhs__text assistant-rhs__text--${turn.role}`}>
                            {turn.role === 'assistant' ? <Markdown message={turn.text}/> : turn.text}
                        </div>
                    </div>
                ))}
                {sending && (
                    <p className='assistant-rhs__pending'>
                        {formatMessage({id: 'assistant_rhs.pending', defaultMessage: 'Reading this channel…'})}
                    </p>
                )}
                <div ref={bottomRef}/>
            </div>
            <form
                className='assistant-rhs__composer'
                onSubmit={onSubmit}
            >
                <textarea
                    id='assistantComposer'
                    className='assistant-rhs__input'
                    rows={2}
                    value={draft}
                    autoFocus={true}
                    disabled={sending}
                    placeholder={formatMessage({id: 'assistant_rhs.placeholder', defaultMessage: 'Ask about this channel'})}
                    aria-label={formatMessage({id: 'assistant_rhs.placeholder', defaultMessage: 'Ask about this channel'})}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            send();
                        }
                    }}
                />
                <Button
                    id='assistantSend'
                    type='submit'
                    size='sm'
                    disabled={sending || draft.trim() === ''}
                >
                    {formatMessage({id: 'assistant_rhs.send', defaultMessage: 'Send'})}
                </Button>
            </form>
        </div>
    );
};

export default AssistantRhs;
