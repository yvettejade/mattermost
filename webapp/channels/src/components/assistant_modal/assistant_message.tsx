// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AssistantAction, AssistantCitation} from '@mattermost/types/assistant';

import Markdown from 'components/markdown';

import {getHistory} from 'utils/browser_history';

import AssistantActionCard from './assistant_action_card';

export type ChatEntry = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    citations?: AssistantCitation[];
    actions?: AssistantAction[];
};

type Props = {
    entry: ChatEntry;
    onAgentResult: (content: string) => void;
    onNavigate: () => void;
};

const markdownOptions = {mentionHighlight: false, atMentions: true, markdown: true};

const CitationLink = ({citation, onNavigate}: {citation: AssistantCitation; onNavigate: () => void}) => {
    const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        getHistory().push(citation.permalink);
        onNavigate();
    }, [citation.permalink, onNavigate]);

    return (
        <li className='AssistantMessage__citation'>
            <a
                href={citation.permalink}
                onClick={handleClick}
            >
                <span className='AssistantMessage__citationIndex'>{`[${citation.index}]`}</span>
                <span className='AssistantMessage__citationChannel'>{`~${citation.channel_display_name}`}</span>
                {citation.username && <span className='AssistantMessage__citationUser'>{`@${citation.username}`}</span>}
            </a>
            <span className='AssistantMessage__citationSnippet'>{citation.snippet}</span>
        </li>
    );
};

const AssistantMessageItem = ({entry, onAgentResult, onNavigate}: Props) => {
    const isUser = entry.role === 'user';
    return (
        <div
            className={classNames('AssistantMessage', {
                'AssistantMessage--user': isUser,
                'AssistantMessage--assistant': !isUser,
            })}
        >
            <div className='AssistantMessage__author'>
                {isUser ? (
                    <FormattedMessage
                        id='assistant.message.you'
                        defaultMessage='You'
                    />
                ) : (
                    <FormattedMessage
                        id='assistant.message.assistant'
                        defaultMessage='Assistant'
                    />
                )}
            </div>
            <div className='AssistantMessage__content'>
                {isUser ? entry.content : (
                    <Markdown
                        message={entry.content}
                        options={markdownOptions}
                    />
                )}
            </div>
            {entry.citations && entry.citations.length > 0 && (
                <div className='AssistantMessage__citations'>
                    <div className='AssistantMessage__citationsTitle'>
                        <FormattedMessage
                            id='assistant.message.sources'
                            defaultMessage='Sources'
                        />
                    </div>
                    <ul>
                        {entry.citations.map((c) => (
                            <CitationLink
                                key={c.post_id}
                                citation={c}
                                onNavigate={onNavigate}
                            />
                        ))}
                    </ul>
                </div>
            )}
            {entry.actions?.map((action) => (
                <AssistantActionCard
                    key={action.id}
                    action={action}
                    onAgentResult={onAgentResult}
                />
            ))}
        </div>
    );
};

export default React.memo(AssistantMessageItem);
