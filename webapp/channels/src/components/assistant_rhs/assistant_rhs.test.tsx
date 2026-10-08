// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AssistantRhs from './assistant_rhs';
import {clearTranscripts, getTranscript} from './transcript';

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        askAssistant: jest.fn(),
    },
}));

jest.mock('components/markdown', () => ({
    __esModule: true,
    default: ({message}: {message: string}) => <div>{message}</div>,
}));

const mockedAsk = Client4.askAssistant as jest.Mock;

describe('AssistantRhs', () => {
    beforeEach(() => {
        clearTranscripts();
        mockedAsk.mockReset();
        mockedAsk.mockResolvedValue({reply: 'grounded summary', intent: 'summarize'});
    });

    const state = {
        entities: {
            channels: {
                currentChannelId: 'channel-1',
                channels: {
                    'channel-1': {
                        id: 'channel-1',
                        display_name: 'Town Square',
                    },
                },
            },
        },
        views: {
            rhs: {
                rhsState: 'assistant',
            },
        },
    };

    test('keeps transcripts per channelId and sends root_id empty', async () => {
        const {unmount} = renderWithContext(<AssistantRhs/>, state);

        await userEvent.type(screen.getByPlaceholderText('Ask Assistant'), 'summarize');
        await userEvent.click(screen.getByRole('button', {name: 'Send'}));

        expect(mockedAsk).toHaveBeenCalledWith('channel-1', {message: 'summarize', root_id: ''});
        expect(await screen.findByText('grounded summary')).toBeInTheDocument();
        expect(getTranscript('channel-1')).toHaveLength(2);

        unmount();
        renderWithContext(<AssistantRhs/>, {
            ...state,
            entities: {
                channels: {
                    currentChannelId: 'channel-2',
                    channels: {
                        'channel-2': {id: 'channel-2', display_name: 'Off-Topic'},
                    },
                },
            },
        });

        expect(screen.queryByText('grounded summary')).not.toBeInTheDocument();
        expect(getTranscript('channel-2')).toHaveLength(0);
    });

    test('Enter sends and Shift+Enter stays on the composer', async () => {
        renderWithContext(<AssistantRhs/>, state);
        const input = screen.getByPlaceholderText('Ask Assistant');

        await userEvent.type(input, 'hello{Enter}');
        expect(mockedAsk).toHaveBeenCalledWith('channel-1', {message: 'hello', root_id: ''});

        mockedAsk.mockClear();
        await userEvent.type(input, 'line{Shift>}{Enter}{/Shift}still here');
        expect(mockedAsk).not.toHaveBeenCalled();
        expect(input).toHaveValue('line\nstill here');
    });
});
