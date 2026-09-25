// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PluginRegistry from 'plugins/registry';

describe('PluginRegistry LeftSidebarAboveInviteMembers', () => {
    test('registerLeftSidebarAboveInviteMembersComponent is defined', () => {
        const registry = new PluginRegistry('com.yvette.grok-agent');
        expect(typeof registry.registerLeftSidebarAboveInviteMembersComponent).toBe('function');
    });
});
