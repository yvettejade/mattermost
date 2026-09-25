import {buildChatRequest} from './modal_state';

describe('buildChatRequest', () => {
    test('includes channel and team from context', () => {
        expect(buildChatRequest('catch me up', {team_id: 't', channel_id: 'c', root_id: 'r'})).toEqual({
            message: 'catch me up',
            team_id: 't',
            channel_id: 'c',
            root_id: 'r',
        });
    });
});
