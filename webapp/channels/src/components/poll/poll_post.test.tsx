// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PollResults} from '@mattermost/types/polls';
import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';

import {receivedPollResults} from 'actions/views/polls';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PollPost from './poll_post';

describe('components/poll/PollPost', () => {
    const post = TestHelper.getPostMock({
        id: 'post1',
        type: 'custom_poll' as Post['type'],
        message: '📊 Lunch?',
        props: {
            poll: {
                question: 'Lunch?',
                options: [
                    {id: 'a', text: 'Tacos'},
                    {id: 'b', text: 'Pizza'},
                ],
            },
        },
    });

    const results = (votes: PollResults['votes']): PollResults => ({
        post_id: 'post1',
        votes,
        total_votes: Object.values(votes).reduce((sum, voters) => sum + voters.length, 0),
    });

    const initialState = (pollResults?: PollResults) => ({
        entities: {
            users: {
                currentUserId: 'me',
                profiles: {
                    me: TestHelper.getUserMock({id: 'me', username: 'me'}),
                    u1: TestHelper.getUserMock({id: 'u1', username: 'u1'}),
                    u2: TestHelper.getUserMock({id: 'u2', username: 'u2'}),
                },
            },
        },
        views: {
            polls: {
                resultsByPostId: pollResults ? {post1: pollResults} : {},
            },
        },
    });

    const option = (name: RegExp) => screen.getByRole('button', {name});

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders question, percentages, counts, and animated bar widths', async () => {
        renderWithContext(<PollPost post={post}/>, initialState(results({a: ['u2', 'me'], b: ['u1']})));

        expect(screen.getByText('Lunch?')).toBeInTheDocument();
        expect(option(/^Tacos: 67%, 2 votes/)).toHaveAttribute('aria-pressed', 'true');
        expect(option(/^Pizza: 33%, 1 vote/)).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('3 votes')).toBeInTheDocument();

        const fills = screen.getAllByTestId('pollBarFill');
        await waitFor(() => expect(fills[0]).toHaveStyle({width: '67%'}));
        expect(fills[1]).toHaveStyle({width: '33%'});
    });

    test('fetches results when none are loaded', async () => {
        const getPollResults = jest.spyOn(Client4, 'getPollResults').mockResolvedValue(results({a: ['u1'], b: []}));

        renderWithContext(<PollPost post={post}/>, initialState());

        expect(getPollResults).toHaveBeenCalledWith('post1');
        await waitFor(() => expect(option(/^Tacos: 100%, 1 vote/)).toBeInTheDocument());
    });

    test('votes optimistically and keeps server results', async () => {
        const votePoll = jest.spyOn(Client4, 'votePoll').mockResolvedValue(results({a: ['me'], b: []}));

        renderWithContext(<PollPost post={post}/>, initialState(results({a: [], b: []})));

        await userEvent.click(option(/^Tacos/));

        expect(votePoll).toHaveBeenCalledWith('post1', 'a');
        expect(option(/^Tacos: 100%, 1 vote/)).toHaveAttribute('aria-pressed', 'true');
    });

    test('changing a vote moves it to the new option', async () => {
        const votePoll = jest.spyOn(Client4, 'votePoll').mockResolvedValue(results({a: ['u1'], b: ['me']}));

        renderWithContext(<PollPost post={post}/>, initialState(results({a: ['u1', 'me'], b: []})));

        await userEvent.click(option(/^Pizza/));

        expect(votePoll).toHaveBeenCalledWith('post1', 'b');
        expect(option(/^Tacos: 50%, 1 vote/)).toHaveAttribute('aria-pressed', 'false');
        expect(option(/^Pizza: 50%, 1 vote/)).toHaveAttribute('aria-pressed', 'true');
    });

    test('clicking the current vote retracts it', async () => {
        const retract = jest.spyOn(Client4, 'retractPollVote').mockResolvedValue(results({a: ['u1'], b: []}));

        renderWithContext(<PollPost post={post}/>, initialState(results({a: ['u1', 'me'], b: []})));

        await userEvent.click(option(/^Tacos/));

        expect(retract).toHaveBeenCalledWith('post1');
        expect(option(/^Tacos: 100%, 1 vote/)).toHaveAttribute('aria-pressed', 'false');
    });

    test('reverts the optimistic vote when the request fails', async () => {
        jest.spyOn(Client4, 'votePoll').mockRejectedValue(new Error('nope'));
        jest.spyOn(Client4, 'getPollResults').mockResolvedValue(results({a: [], b: ['u1']}));

        renderWithContext(<PollPost post={post}/>, initialState(results({a: [], b: ['u1']})));

        await userEvent.click(option(/^Tacos/));

        await waitFor(() => expect(option(/^Tacos: 0%, 0 votes/)).toHaveAttribute('aria-pressed', 'false'));
        expect(option(/^Pizza: 100%, 1 vote/)).toBeInTheDocument();
    });

    test('updates live when results arrive from another client', () => {
        const {store} = renderWithContext(<PollPost post={post}/>, initialState(results({a: [], b: []})));

        act(() => {
            store.dispatch(receivedPollResults(results({a: ['u1'], b: ['u2', 'me']})));
        });

        expect(option(/^Tacos: 33%, 1 vote/)).toBeInTheDocument();
        expect(option(/^Pizza: 67%, 2 votes/)).toBeInTheDocument();
        expect(screen.getByText('3 votes')).toBeInTheDocument();
    });
});
