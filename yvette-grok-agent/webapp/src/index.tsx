import React from 'react';

import GrokChatModal from './chat_modal';
import GrokSidebarButton from './sidebar_button';
import './grok_modal.css';

type PluginRegistry = {
    registerLeftSidebarAboveInviteMembersComponent: (component: React.ComponentType) => string;
    registerRootComponent: (component: React.ComponentType) => string;
};

class Plugin {
    initialize(registry: PluginRegistry) {
        registry.registerLeftSidebarAboveInviteMembersComponent(GrokSidebarButton);
        registry.registerRootComponent(GrokChatModal);
    }
}

declare global {
    interface Window {
        registerPlugin: (id: string, plugin: Plugin) => void;
    }
}

window.registerPlugin('com.yvette.grok-agent', new Plugin());
