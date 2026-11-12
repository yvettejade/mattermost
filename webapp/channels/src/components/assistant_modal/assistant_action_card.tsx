// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {AssistantAction} from '@mattermost/types/assistant';
import type {ServerError} from '@mattermost/types/errors';

import {executeAssistantAction} from 'mattermost-redux/actions/assistant';

import Markdown from 'components/markdown';

import {copyToClipboard} from 'utils/utils';

type Props = {
    action: AssistantAction;
    onAgentResult: (content: string) => void;
};

type CardState = 'pending' | 'running' | 'done' | 'dismissed';

const markdownOptions = {mentionHighlight: false, markdown: true};

const AssistantActionCard = ({action, onAgentResult}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [state, setState] = useState<CardState>('pending');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const isAgent = action.type === 'route_to_agent';
    const canPost = isAgent || Boolean(action.channel_id);
    const channelName = action.channel_display_name || '';

    const confirm = useCallback(async () => {
        setState('running');
        setError('');
        const {data, error: requestError} = await dispatch(executeAssistantAction({type: action.type, args: action.args}));
        if (requestError || !data) {
            setState('pending');
            setError((requestError as ServerError | undefined)?.message || formatMessage({id: 'assistant.action.error', defaultMessage: 'The action failed. Please try again.'}));
            return;
        }
        setState('done');
        if (isAgent && data.content) {
            onAgentResult(data.content);
        }
    }, [action.args, action.type, dispatch, formatMessage, isAgent, onAgentResult]);

    const dismiss = useCallback(() => setState('dismissed'), []);

    const copy = useCallback(() => {
        const args = action.args as {title?: string; content?: string};
        copyToClipboard(action.preview || args.content || '');
        setCopied(true);
    }, [action.args, action.preview]);

    let confirmLabel;
    let description;
    switch (action.type) {
    case 'route_to_agent':
        confirmLabel = formatMessage({id: 'assistant.action.runAgent', defaultMessage: 'Run agent'});
        description = formatMessage({id: 'assistant.action.agentDescription', defaultMessage: 'Runs a specialized agent on content you have access to. Nothing is posted.'});
        break;
    case 'create_canvas':
        confirmLabel = formatMessage({id: 'assistant.action.postCanvas', defaultMessage: 'Create canvas'});
        description = formatMessage({id: 'assistant.action.canvasDescription', defaultMessage: 'Posts this canvas as you in ~{channel}{pin, select, true { and pins it} other {}}.'}, {channel: channelName, pin: Boolean(action.args.pin)});
        break;
    case 'schedule_meeting':
        confirmLabel = formatMessage({id: 'assistant.action.postMeeting', defaultMessage: 'Post proposal'});
        description = formatMessage({id: 'assistant.action.postDescription', defaultMessage: 'Posts this message as you in ~{channel}.'}, {channel: channelName});
        break;
    default:
        confirmLabel = formatMessage({id: 'assistant.action.post', defaultMessage: 'Post'});
        description = canPost ? formatMessage({id: 'assistant.action.postDescription', defaultMessage: 'Posts this message as you in ~{channel}.'}, {channel: channelName}) : undefined;
    }

    return (
        <section
            className='AssistantActionCard'
            aria-label={action.title}
        >
            <h3 className='AssistantActionCard__title'>{action.title}</h3>
            {action.preview && (
                <div className='AssistantActionCard__preview'>
                    <Markdown
                        message={action.preview}
                        options={markdownOptions}
                    />
                </div>
            )}
            {state === 'done' && (
                <div
                    className='AssistantActionCard__status AssistantActionCard__status--done'
                    role='status'
                >
                    {isAgent ? (
                        <FormattedMessage
                            id='assistant.action.agentDone'
                            defaultMessage='Agent finished. See the result below.'
                        />
                    ) : (
                        <FormattedMessage
                            id='assistant.action.done'
                            defaultMessage='Posted to ~{channel}.'
                            values={{channel: channelName}}
                        />
                    )}
                </div>
            )}
            {state === 'dismissed' && (
                <div className='AssistantActionCard__status'>
                    <FormattedMessage
                        id='assistant.action.dismissed'
                        defaultMessage='Dismissed. Nothing was posted.'
                    />
                </div>
            )}
            {error && (
                <div
                    className='AssistantActionCard__error'
                    role='alert'
                >
                    {error}
                </div>
            )}
            {(state === 'pending' || state === 'running') && (
                <>
                    {description && <p className='AssistantActionCard__description'>{description}</p>}
                    <div className='AssistantActionCard__buttons'>
                        {canPost && (
                            <Button
                                emphasis='primary'
                                size='sm'
                                onClick={confirm}
                                disabled={state === 'running'}
                            >
                                {confirmLabel}
                            </Button>
                        )}
                        {action.type === 'draft_document' && (
                            <Button
                                emphasis='secondary'
                                size='sm'
                                onClick={copy}
                            >
                                {copied ? (
                                    <FormattedMessage
                                        id='assistant.action.copied'
                                        defaultMessage='Copied'
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='assistant.action.copy'
                                        defaultMessage='Copy markdown'
                                    />
                                )}
                            </Button>
                        )}
                        <Button
                            emphasis='tertiary'
                            size='sm'
                            onClick={dismiss}
                            disabled={state === 'running'}
                        >
                            <FormattedMessage
                                id='assistant.action.dismiss'
                                defaultMessage='Dismiss'
                            />
                        </Button>
                    </div>
                </>
            )}
        </section>
    );
};

export default AssistantActionCard;
