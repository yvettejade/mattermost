import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import ChatModal from './chat_modal';
import {openChatModal, setPluginStore} from './modal_state';

const fetchMock = jest.fn();

describe('ChatModal', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        (global as any).fetch = fetchMock;
        setPluginStore({
            getState: () => ({
                entities: {
                    teams: {currentTeamId: 'team-1'},
                    channels: {currentChannelId: 'chan-1'},
                },
            }),
        });
        openChatModal();
    });

    test('sends payload with channel id and renders reply markdown', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({reply: '**Path A** cited summary', actions_taken: [{type: 'qa', status: 'ok'}]}),
        });

        render(<ChatModal/>);
        await userEvent.type(screen.getByPlaceholderText('Ask about this channel…'), 'what happened in this channel?');
        await userEvent.click(screen.getByRole('button', {name: 'Send'}));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/plugins/com.yvette.grok-agent/api/v1/chat');
        const payload = JSON.parse(init.body);
        expect(payload.channel_id).toBe('chan-1');
        expect(payload.team_id).toBe('team-1');
        expect(payload.message).toBe('what happened in this channel?');

        expect(await screen.findByText('**Path A** cited summary')).toBeInTheDocument();
    });
});
