// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route} from 'react-router-dom';

import {getThreadCounts} from 'mattermost-redux/actions/threads';
import {CollapsedThreads} from '@mattermost/types/config';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import GlobalThreadsLink from './global_threads_link';

jest.mock('mattermost-redux/actions/threads', () => ({
    getThreadCounts: jest.fn(() => ({type: 'MOCK_GET_THREAD_COUNTS'})),
}));

const mockRouting = {
    currentUserId: 'user1',
    currentTeamId: 'team1',
    goToInChannel: jest.fn(),
    select: jest.fn(),
    clear: jest.fn(),
};

jest.mock('../hooks', () => ({
    useThreadRouting: () => mockRouting,
}));

const baseState = {
    entities: {
        general: {
            config: {
                CollapsedThreads: CollapsedThreads.ALWAYS_ON,
            },
        },
        preferences: {
            myPreferences: {},
        },
        teams: {
            currentTeamId: 'team1',
            teams: {
                team1: TestHelper.getTeamMock({id: 'team1'}),
            },
        },
        users: {
            currentUserId: 'user1',
            profiles: {
                user1: TestHelper.getUserMock({id: 'user1'}),
            },
        },
        threads: {
            countsIncludingDirect: {
                team1: {
                    total: 10,
                    total_unread_threads: 5,
                    total_unread_mentions: 150,
                },
            },
        },
    },
    views: {
        rhs: {
            isSidebarOpen: false,
            rhsState: null,
        },
    },
};

function renderLink() {
    return renderWithContext(
        <MemoryRouter initialEntries={['/team1/channels/town-square']}>
            <Route path='/:team/channels/:channelIdentifier?'>
                <GlobalThreadsLink/>
            </Route>
        </MemoryRouter>,
        baseState,
    );
}

describe('components/threading/global_threads_link/GlobalThreadsLink', () => {
    beforeEach(() => {
        jest.mocked(getThreadCounts).mockClear();
    });

    test('displays 99+ on Threads sidebar badge when unread mentions exceed cap (HP-3)', () => {
        renderLink();

        expect(screen.getByText('Threads')).toBeInTheDocument();
        expect(screen.getByText('99+')).toBeInTheDocument();
        expect(screen.queryByText('150')).not.toBeInTheDocument();
        expect(document.getElementById('sidebarItem_threads')).toBeInTheDocument();
        expect(document.getElementById('unreadMentions')).toBeInTheDocument();
    });
});
