// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {ChartBarIcon, CheckCircleIcon} from '@mattermost/compass-icons/components';
import type {Post} from '@mattermost/types/posts';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {fetchPollResults, receivedPollResults, votePoll} from 'actions/views/polls';
import {getPollResults} from 'selectors/views/polls';

import Avatars from 'components/widgets/users/avatars';

import type {GlobalState} from 'types/store';

import {applyVoteLocally, emptyPollResults, getPercent, getPollFromPost, getUserVote} from './utils';

import './poll_post.scss';

type Props = {
    post: Post;
};

const PollPost = ({post}: Props) => {
    const {formatMessage, formatNumber} = useIntl();
    const dispatch = useDispatch();

    const poll = useMemo(() => getPollFromPost(post), [post]);
    const currentUserId = useSelector(getCurrentUserId);
    const storedResults = useSelector((state: GlobalState) => getPollResults(state, post.id));
    const isPending = Boolean(post.pending_post_id) && post.pending_post_id === post.id;

    // Bars render at 0% first so the initial results animate in.
    const [revealed, setRevealed] = useState(false);
    useEffect(() => {
        const frame = requestAnimationFrame(() => setRevealed(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (!storedResults && !isPending) {
            dispatch(fetchPollResults(post.id));
        }
    }, [dispatch, storedResults, post.id, isPending]);

    const results = useMemo(() => {
        if (!poll) {
            return undefined;
        }
        return storedResults ?? emptyPollResults(post.id, poll);
    }, [poll, storedResults, post.id]);

    const myVote = results ? getUserVote(results, currentUserId) : undefined;

    const handleVote = useCallback(async (optionId: string) => {
        if (!results || isPending) {
            return;
        }

        const nextOptionId = optionId === myVote ? null : optionId;
        dispatch(receivedPollResults(applyVoteLocally(results, currentUserId, nextOptionId)));

        const {error} = await dispatch(votePoll(post.id, nextOptionId));
        if (error) {
            dispatch(fetchPollResults(post.id));
        }
    }, [dispatch, results, myVote, currentUserId, post.id, isPending]);

    if (!poll || !results) {
        return <p>{post.message}</p>;
    }

    const total = results.total_votes;
    const maxCount = Math.max(0, ...poll.options.map((option) => results.votes[option.id]?.length ?? 0));

    return (
        <div
            className='PollPost'
            data-testid={`pollPost-${post.id}`}
        >
            <div className='PollPost__header'>
                <span className='PollPost__badge'>
                    <ChartBarIcon size={14}/>
                    <FormattedMessage
                        id='poll.post.badge'
                        defaultMessage='Poll'
                    />
                </span>
                <h4 className='PollPost__question'>{poll.question}</h4>
            </div>

            <ul className='PollPost__options'>
                {poll.options.map((option) => {
                    const voters = results.votes[option.id] ?? [];
                    const count = voters.length;
                    const percent = getPercent(count, total);
                    const selected = option.id === myVote;
                    const leading = count > 0 && count === maxCount;

                    return (
                        <li
                            key={option.id}
                            className='PollPost__option'
                        >
                            <button
                                type='button'
                                className={classNames('PollPost__bar', {
                                    'PollPost__bar--selected': selected,
                                    'PollPost__bar--leading': leading,
                                })}
                                aria-pressed={selected}
                                disabled={isPending}
                                onClick={() => handleVote(option.id)}
                                aria-label={formatMessage({
                                    id: 'poll.post.option_aria',
                                    defaultMessage: '{option}: {percent}%, {count, plural, one {# vote} other {# votes}}',
                                }, {option: option.text, percent, count})}
                            >
                                <span
                                    className='PollPost__fill'
                                    data-testid='pollBarFill'
                                    style={{width: `${revealed ? percent : 0}%`}}
                                />
                                <span className='PollPost__label'>
                                    {selected && (
                                        <CheckCircleIcon
                                            size={16}
                                            className='PollPost__check'
                                        />
                                    )}
                                    <span className='PollPost__text'>{option.text}</span>
                                </span>
                                <span className='PollPost__stats'>
                                    <span className='PollPost__percent'>
                                        {formatNumber(percent / 100, {style: 'percent'})}
                                    </span>
                                    <span className='PollPost__count'>
                                        <FormattedMessage
                                            id='poll.post.count'
                                            defaultMessage='{count, plural, one {# vote} other {# votes}}'
                                            values={{count}}
                                        />
                                    </span>
                                </span>
                            </button>
                            <div className={classNames('PollPost__voters', {'PollPost__voters--collapsed': total === 0})}>
                                {count > 0 && (
                                    <Avatars
                                        userIds={voters}
                                        size='xs'
                                    />
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            <div className='PollPost__footer'>
                <span className='PollPost__total'>
                    <FormattedMessage
                        id='poll.post.total'
                        defaultMessage='{count, plural, one {# vote} other {# votes}}'
                        values={{count: total}}
                    />
                </span>
                {myVote ? (
                    <FormattedMessage
                        id='poll.post.hint_voted'
                        defaultMessage='Click an option to change or remove your vote'
                    />
                ) : (
                    <FormattedMessage
                        id='poll.post.hint'
                        defaultMessage='Click an option to vote'
                    />
                )}
            </div>
        </div>
    );
};

export default memo(PollPost);
