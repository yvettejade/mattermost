// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AssistantChatResponse} from '@mattermost/types/assistant';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AssistantModal from './assistant_modal';

const initialState = {
    entities: {
        users: {
            currentUserId: 'user1',
            profiles: {user1: {id: 'user1', username: 'alice'}},
        },
        teams: {
            currentTeamId: 'team1',
            teams: {team1: {id: 'team1', name: 'team-one', display_name: 'Team One'}},
        },
        channels: {
            currentChannelId: 'channel1',
            channels: {
                channel1: {id: 'channel1', name: 'town-square', display_name: 'Town Square', team_id: 'team1', type: 'O'},
            },
        },
    },
};

const answer: AssistantChatResponse = {
    message: {role: 'assistant', content: 'The launch is on Friday [1].'},
    citations: [{
        index: 1,
        post_id: 'post1',
        channel_id: 'channel1',
        channel_name: 'town-square',
        channel_display_name: 'Town Square',
        team_name: 'team-one',
        username: 'bob',
        create_at: 1,
        snippet: 'Launch moved to Friday',
        permalink: '/team-one/pl/post1',
    }],
    actions: [],
};

const withAction = (action: AssistantChatResponse['actions'][number]): AssistantChatResponse => ({
    message: {role: 'assistant', content: 'I\'ve prepared an action for you to review.'},
    citations: [],
    actions: [action],
});

function renderModal() {
    return renderWithContext(<AssistantModal onExited={jest.fn()}/>, initialState);
}

async function ask(question: string) {
    await userEvent.type(screen.getByRole('textbox', {name: 'Message the assistant'}), question);
    await userEvent.click(screen.getByRole('button', {name: 'Send'}));
}

describe('components/assistant_modal/AssistantModal', () => {
    beforeEach(() => {
        jest.spyOn(Client4, 'getAssistantStatus').mockResolvedValue({configured: true, agents: [{name: 'action_items', description: 'extracts action items'}]});
        jest.spyOn(Client4, 'assistantChat').mockResolvedValue(answer);
        jest.spyOn(Client4, 'executeAssistantAction').mockResolvedValue({});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('shows the current channel context and an empty state', async () => {
        renderModal();

        expect(screen.getByText('Assistant')).toBeVisible();
        expect(screen.getByText(/focused on ~Town Square/)).toBeVisible();
        expect(screen.getByText(/Nothing is posted until you confirm it/)).toBeVisible();
        expect(screen.getByRole('button', {name: 'Summarize this thread'})).toBeDisabled();
        await waitFor(() => expect(Client4.getAssistantStatus).toHaveBeenCalled());
    });

    test('sends a question with channel context and renders the answer with sources', async () => {
        renderModal();

        await ask('When is the launch?');

        await waitFor(() => expect(screen.getByText(/The launch is on Friday/)).toBeVisible());
        expect(Client4.assistantChat).toHaveBeenCalledWith({
            message: 'When is the launch?',
            mode: 'ask',
            history: [],
            channel_id: 'channel1',
            root_id: undefined,
        });
        expect(screen.getByText('When is the launch?')).toBeVisible();
        expect(screen.getByText('Sources')).toBeVisible();
        expect(screen.getByRole('link', {name: /\[1\] ~Town Square @bob/})).toHaveAttribute('href', '/team-one/pl/post1');
        expect(screen.getByText('Launch moved to Friday')).toBeVisible();
    });

    test('sends prior turns as history', async () => {
        renderModal();

        await ask('first');
        await waitFor(() => expect(screen.getByText(/The launch is on Friday/)).toBeVisible());
        await ask('second');

        await waitFor(() => expect(Client4.assistantChat).toHaveBeenCalledTimes(2));
        expect(Client4.assistantChat).toHaveBeenLastCalledWith(expect.objectContaining({
            message: 'second',
            history: [
                {role: 'user', content: 'first'},
                {role: 'assistant', content: 'The launch is on Friday [1].'},
            ],
        }));
    });

    test('shows a loading state while waiting for a response', async () => {
        let resolve: (value: AssistantChatResponse) => void = () => {};
        jest.spyOn(Client4, 'assistantChat').mockReturnValue(new Promise((r) => {
            resolve = r;
        }));
        renderModal();

        await ask('Hello?');

        expect(screen.getByRole('status')).toHaveTextContent('Thinking…');
        expect(screen.getByRole('button', {name: 'Send'})).toBeDisabled();

        resolve(answer);
        await waitFor(() => expect(screen.queryByText('Thinking…')).not.toBeInTheDocument());
    });

    test('displays server errors', async () => {
        jest.spyOn(Client4, 'assistantChat').mockRejectedValue({message: 'The assistant could not get a response from the AI provider.', status_code: 502});
        renderModal();

        await ask('Hello?');

        expect(await screen.findByRole('alert')).toHaveTextContent('could not get a response from the AI provider');
    });

    test('shows a not configured message and disables input', async () => {
        jest.spyOn(Client4, 'getAssistantStatus').mockResolvedValue({configured: false, agents: []});
        renderModal();

        expect(await screen.findByRole('alert')).toHaveTextContent('The assistant isn\'t configured on this server');
        expect(screen.getByRole('textbox', {name: 'Message the assistant'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Summarize recent activity'})).toBeDisabled();
    });

    test('quick actions request summaries', async () => {
        renderModal();

        await userEvent.click(screen.getByRole('button', {name: 'Catch me up on unread messages'}));

        await waitFor(() => expect(Client4.assistantChat).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'summarize_unread',
            channel_id: 'channel1',
        })));
    });

    test('does not post a proposed action until the user confirms it', async () => {
        jest.spyOn(Client4, 'assistantChat').mockResolvedValue(withAction({
            id: 'call_1',
            type: 'create_post',
            title: 'Post a message',
            channel_id: 'channel1',
            channel_display_name: 'Town Square',
            args: {channel_id: 'channel1', message: 'Hello team'},
            preview: 'Hello team',
        }));
        jest.spyOn(Client4, 'executeAssistantAction').mockResolvedValue({post: {id: 'new'} as never});
        renderModal();

        await ask('Say hello');

        const card = await screen.findByRole('region', {name: 'Post a message'});
        expect(card).toHaveTextContent('Hello team');
        expect(card).toHaveTextContent('Posts this message as you in ~Town Square.');
        expect(Client4.executeAssistantAction).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: 'Post'}));

        expect(Client4.executeAssistantAction).toHaveBeenCalledWith({type: 'create_post', args: {channel_id: 'channel1', message: 'Hello team'}});
        expect(await screen.findByText('Posted to ~Town Square.')).toBeVisible();
    });

    test('dismissing an action never executes it', async () => {
        jest.spyOn(Client4, 'assistantChat').mockResolvedValue(withAction({
            id: 'call_2',
            type: 'schedule_meeting',
            title: 'Propose meeting: Sync',
            channel_id: 'channel1',
            channel_display_name: 'Town Square',
            args: {channel_id: 'channel1', title: 'Sync', start_time: 'tomorrow'},
            preview: 'Meeting proposal: Sync',
        }));
        renderModal();

        await ask('Schedule a sync');
        await userEvent.click(await screen.findByRole('button', {name: 'Dismiss'}));

        expect(screen.getByText('Dismissed. Nothing was posted.')).toBeVisible();
        expect(screen.queryByRole('button', {name: 'Post proposal'})).not.toBeInTheDocument();
        expect(Client4.executeAssistantAction).not.toHaveBeenCalled();
    });

    test('shows an error when a confirmed action fails and allows retrying', async () => {
        jest.spyOn(Client4, 'assistantChat').mockResolvedValue(withAction({
            id: 'call_3',
            type: 'create_canvas',
            title: 'Create canvas: Roadmap',
            channel_id: 'channel1',
            channel_display_name: 'Town Square',
            args: {channel_id: 'channel1', title: 'Roadmap', sections: [{heading: 'Now', body: 'Ship'}], pin: true},
            preview: 'Roadmap',
        }));
        jest.spyOn(Client4, 'executeAssistantAction').mockRejectedValue({message: 'You do not have permission', status_code: 403});
        renderModal();

        await ask('Make a canvas');
        expect(await screen.findByText(/and pins it/)).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: 'Create canvas'}));

        expect(await screen.findByText('You do not have permission')).toBeVisible();
        expect(screen.getByRole('button', {name: 'Create canvas'})).toBeEnabled();
    });

    test('runs a specialized agent after confirmation and shows its result', async () => {
        jest.spyOn(Client4, 'assistantChat').mockResolvedValue(withAction({
            id: 'call_4',
            type: 'route_to_agent',
            title: 'Ask the action_items agent',
            channel_id: 'channel1',
            channel_display_name: 'Town Square',
            args: {agent: 'action_items', task: 'list todos', channel_id: 'channel1'},
            preview: 'list todos',
        }));
        jest.spyOn(Client4, 'executeAssistantAction').mockResolvedValue({content: 'Bob owns the docs update'});
        renderModal();

        await ask('What are the todos?');
        await userEvent.click(await screen.findByRole('button', {name: 'Run agent'}));

        expect(await screen.findByText('Bob owns the docs update')).toBeVisible();
        expect(screen.getByText('Agent finished. See the result below.')).toBeVisible();
    });

    test('offers copy for drafted documents without a channel', async () => {
        jest.spyOn(Client4, 'assistantChat').mockResolvedValue(withAction({
            id: 'call_5',
            type: 'draft_document',
            title: 'Draft document: Spec',
            args: {title: 'Spec', content: 'Body'},
            preview: '# Spec\n\nBody',
        }));
        renderModal();

        await ask('Draft a spec');

        expect(await screen.findByRole('button', {name: 'Copy markdown'})).toBeVisible();
        expect(screen.queryByRole('button', {name: 'Post'})).not.toBeInTheDocument();
    });
});
