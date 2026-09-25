import React from 'react';

import ChatModal from './chat_modal';
import {setPluginStore} from './modal_state';
import SidebarButton from './sidebar_button';

import './styles.css';

type PluginRegistry = {
    registerRootComponent: (component: React.ComponentType) => string;
    registerLeftSidebarAboveInviteMembersComponent?: (component: React.ComponentType) => string;
};

class Plugin {
    initialize(registry: PluginRegistry, store: {getState: () => any}) {
        setPluginStore(store);
        registry.registerRootComponent(ChatModal);
        if (registry.registerLeftSidebarAboveInviteMembersComponent) {
            registry.registerLeftSidebarAboveInviteMembersComponent(SidebarButton);
        }
    }

    uninitialize() {
        setPluginStore(null);
    }
}

declare global {
    interface Window {
        registerPlugin: (id: string, plugin: Plugin) => void;
    }
}

window.registerPlugin('com.yvette.grok-agent', new Plugin());
