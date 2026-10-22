// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Poll} from '@mattermost/types/polls';
import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PollCreateModal from './poll_create_modal';

describe('components/poll/PollCreateModal', () => {
    const initialState = {
        entities: {
            users: {
                currentUserId: 'me',
                profiles: {me: TestHelper.getUserMock({id: 'me'})},
            },
            channels: {
                channels: {channel1: TestHelper.getChannelMock({id: 'channel1', team_id: 'team1'})},
            },
        },
    };

    const renderModal = () => renderWithContext(
        <PollCreateModal
            channelId='channel1'
            rootId=''
            onExited={jest.fn()}
        />,
        initialState,
    );

    const postButton = () => screen.getByRole('button', {name: 'Post poll'});

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('requires a question and two options', async () => {
        renderModal();
        expect(postButton()).toBeDisabled();

        await userEvent.type(screen.getByTestId('pollQuestionInput'), 'Lunch?');
        await userEvent.type(screen.getByTestId('pollOptionInput-0'), 'Tacos');
        expect(postButton()).toBeDisabled();

        await userEvent.type(screen.getByTestId('pollOptionInput-1'), 'Pizza');
        expect(postButton()).toBeEnabled();
    });

    test('shows the vote visibility notice', () => {
        renderModal();
        expect(screen.getByTestId('pollVisibilityNotice')).toHaveTextContent('Votes are visible to channel members');
    });

    test('adds and removes options', async () => {
        renderModal();
        expect(screen.queryByRole('button', {name: /Remove option/})).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Add option'}));
        expect(screen.getByTestId('pollOptionInput-2')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Remove option 3'}));
        expect(screen.queryByTestId('pollOptionInput-2')).not.toBeInTheDocument();
    });

    test('caps options at ten', async () => {
        renderModal();
        const add = screen.getByRole('button', {name: 'Add option'});
        for (let i = 0; i < 8; i++) {
            // eslint-disable-next-line no-await-in-loop
            await userEvent.click(add);
        }

        expect(screen.getByTestId('pollOptionInput-9')).toBeInTheDocument();
        expect(add).toBeDisabled();
    });

    test('posts a custom_poll post with trimmed, non-empty options', async () => {
        const createPost = jest.spyOn(Client4, 'createPost').mockImplementation(async (post) => TestHelper.getPostMock({...post, id: 'post1'} as Partial<Post>));

        renderModal();
        await userEvent.type(screen.getByTestId('pollQuestionInput'), '  Lunch?  ');
        await userEvent.type(screen.getByTestId('pollOptionInput-0'), ' Tacos ');
        await userEvent.click(screen.getByRole('button', {name: 'Add option'}));
        await userEvent.type(screen.getByTestId('pollOptionInput-2'), 'Pizza');
        await userEvent.click(postButton());

        await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
        const sent = createPost.mock.calls[0][0];
        expect(sent.type).toBe('custom_poll');
        expect(sent.channel_id).toBe('channel1');
        expect(sent.message).toBe('📊 Lunch?');
        const poll = sent.props?.poll as Poll;
        expect(poll.question).toBe('Lunch?');
        expect(poll.options.map((o) => o.text)).toEqual(['Tacos', 'Pizza']);
    });
});
