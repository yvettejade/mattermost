// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {SendIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import {Button} from '@mattermost/shared/components/button';
import type {AssistantChatRequest, AssistantMode} from '@mattermost/types/assistant';
import type {ServerError} from '@mattermost/types/errors';

import {getAssistantStatus, sendAssistantMessage} from 'mattermost-redux/actions/assistant';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {closeModal} from 'actions/views/modals';
import {getSelectedPostId} from 'selectors/rhs';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import type {GlobalState} from 'types/store';

import AssistantMessageItem from './assistant_message';
import type {ChatEntry} from './assistant_message';

import './assistant_modal.scss';

type Props = {
    onExited: () => void;
};

const NOT_CONFIGURED_ERROR_ID = 'app.assistant.not_configured.app_error';

let entrySeq = 0;
const nextEntryId = () => `assistant-entry-${++entrySeq}`;

const AssistantModal = ({onExited}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const threadRootId = useSelector((state: GlobalState) => {
        const selectedPostId = getSelectedPostId(state);
        if (!selectedPostId) {
            return '';
        }
        const post = getPost(state, selectedPostId);
        return post?.root_id || post?.id || '';
    });

    const [entries, setEntries] = useState<ChatEntry[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [configured, setConfigured] = useState(true);
    const listRef = useRef<HTMLDivElement>(null);

    const notConfiguredMessage = formatMessage({
        id: 'assistant.modal.notConfigured',
        defaultMessage: 'The assistant isn\'t configured on this server. Ask your system admin to set the Grok API key.',
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const {data} = await dispatch(getAssistantStatus());
            if (!cancelled && data && !data.configured) {
                setConfigured(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [dispatch]);

    useEffect(() => {
        const list = listRef.current;
        if (list && typeof list.scrollTo === 'function') {
            list.scrollTo({top: list.scrollHeight});
        }
    }, [entries, loading]);

    const appendEntry = useCallback((entry: ChatEntry) => {
        setEntries((prev) => [...prev, entry]);
    }, []);

    const send = useCallback(async (message: string, mode: AssistantMode, label?: string) => {
        if (loading) {
            return;
        }
        setError('');
        const history = entries.map(({role, content}) => ({role, content}));
        appendEntry({id: nextEntryId(), role: 'user', content: label ?? message});
        setLoading(true);

        const request: AssistantChatRequest = {
            message,
            mode,
            history,
            channel_id: channel?.id,
            root_id: threadRootId || undefined,
        };
        const {data, error: requestError} = await dispatch(sendAssistantMessage(request));
        setLoading(false);

        if (requestError || !data) {
            const serverError = requestError as ServerError | undefined;
            if (serverError?.server_error_id === NOT_CONFIGURED_ERROR_ID) {
                setConfigured(false);
            } else {
                setError(serverError?.message || formatMessage({id: 'assistant.modal.genericError', defaultMessage: 'Something went wrong. Please try again.'}));
            }
            return;
        }

        appendEntry({
            id: nextEntryId(),
            role: 'assistant',
            content: data.message.content,
            citations: data.citations,
            actions: data.actions,
        });
    }, [appendEntry, channel?.id, dispatch, entries, formatMessage, loading, threadRootId]);

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
        const message = input.trim();
        if (!message) {
            return;
        }
        setInput('');
        send(message, 'ask');
    }, [input, send]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isKeyPressed(e, Constants.KeyCodes.ENTER) && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    const summarizeThread = useCallback(() => {
        send('', 'summarize_thread', formatMessage({id: 'assistant.modal.quick.thread', defaultMessage: 'Summarize this thread'}));
    }, [formatMessage, send]);

    const summarizeUnread = useCallback(() => {
        send('', 'summarize_unread', formatMessage({id: 'assistant.modal.quick.unread', defaultMessage: 'Catch me up on unread messages'}));
    }, [formatMessage, send]);

    const summarizeRecent = useCallback(() => {
        send('', 'summarize_recent', formatMessage({id: 'assistant.modal.quick.recent', defaultMessage: 'Summarize recent activity'}));
    }, [formatMessage, send]);

    const handleAgentResult = useCallback((content: string) => {
        appendEntry({id: nextEntryId(), role: 'assistant', content});
    }, [appendEntry]);

    const handleNavigate = useCallback(() => {
        dispatch(closeModal(ModalIdentifiers.ASSISTANT_MODAL));
    }, [dispatch]);

    const disabled = loading || !configured;

    return (
        <GenericModal
            className='AssistantModal'
            id='assistantModal'
            onExited={onExited}
            modalHeaderText={formatMessage({id: 'assistant.modal.title', defaultMessage: 'Assistant'})}
            modalSubheaderText={channel ? formatMessage(
                {id: 'assistant.modal.context', defaultMessage: 'Using content you can access, focused on ~{channel}{thread, select, true { and the open thread} other {}}'},
                {channel: channel.display_name || channel.name, thread: Boolean(threadRootId)},
            ) : undefined}
            compassDesign={true}
            bodyPadding={false}
            footerDivider={true}
            footerContent={(
                <form
                    className='AssistantModal__composer'
                    onSubmit={handleSubmit}
                >
                    <textarea
                        className='AssistantModal__input form-control'
                        aria-label={formatMessage({id: 'assistant.modal.inputLabel', defaultMessage: 'Message the assistant'})}
                        placeholder={formatMessage({id: 'assistant.modal.inputPlaceholder', defaultMessage: 'Ask about your channels, or ask me to draft, post or schedule something…'})}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={!configured}
                        rows={2}
                    />
                    <Button
                        type='submit'
                        emphasis='primary'
                        disabled={disabled || !input.trim()}
                        aria-label={formatMessage({id: 'assistant.modal.send', defaultMessage: 'Send'})}
                    >
                        <SendIcon size={18}/>
                    </Button>
                </form>
            )}
        >
            <div className='AssistantModal__body'>
                <div
                    className='AssistantModal__quickActions'
                    role='group'
                    aria-label={formatMessage({id: 'assistant.modal.quickActions', defaultMessage: 'Quick actions'})}
                >
                    <Button
                        emphasis='tertiary'
                        size='sm'
                        onClick={summarizeThread}
                        disabled={disabled || !threadRootId}
                    >
                        <FormattedMessage
                            id='assistant.modal.quick.thread'
                            defaultMessage='Summarize this thread'
                        />
                    </Button>
                    <Button
                        emphasis='tertiary'
                        size='sm'
                        onClick={summarizeUnread}
                        disabled={disabled || !channel}
                    >
                        <FormattedMessage
                            id='assistant.modal.quick.unread'
                            defaultMessage='Catch me up on unread messages'
                        />
                    </Button>
                    <Button
                        emphasis='tertiary'
                        size='sm'
                        onClick={summarizeRecent}
                        disabled={disabled}
                    >
                        <FormattedMessage
                            id='assistant.modal.quick.recent'
                            defaultMessage='Summarize recent activity'
                        />
                    </Button>
                </div>

                {!configured && (
                    <div
                        className='AssistantModal__banner AssistantModal__banner--warning'
                        role='alert'
                    >
                        <i className='icon icon-alert-outline'/>
                        <span>{notConfiguredMessage}</span>
                    </div>
                )}

                <div
                    className='AssistantModal__messages'
                    ref={listRef}
                    role='log'
                    aria-live='polite'
                    aria-label={formatMessage({id: 'assistant.modal.conversation', defaultMessage: 'Conversation'})}
                >
                    {entries.length === 0 && (
                        <div className='AssistantModal__empty'>
                            <FormattedMessage
                                id='assistant.modal.empty'
                                defaultMessage='Ask a question and I will answer from messages you have access to, with links to the sources. I can also draft documents, propose posts, meetings and canvases. Nothing is posted until you confirm it.'
                            />
                        </div>
                    )}
                    {entries.map((entry) => (
                        <AssistantMessageItem
                            key={entry.id}
                            entry={entry}
                            onAgentResult={handleAgentResult}
                            onNavigate={handleNavigate}
                        />
                    ))}
                    {loading && (
                        <div
                            className='AssistantModal__loading'
                            role='status'
                        >
                            <LoadingSpinner/>
                            <FormattedMessage
                                id='assistant.modal.thinking'
                                defaultMessage='Thinking…'
                            />
                        </div>
                    )}
                </div>

                {error && configured && (
                    <div
                        className='AssistantModal__banner AssistantModal__banner--error'
                        role='alert'
                    >
                        <i className='icon icon-alert-circle-outline'/>
                        <span>{error}</span>
                    </div>
                )}
            </div>
        </GenericModal>
    );
};

export default AssistantModal;
