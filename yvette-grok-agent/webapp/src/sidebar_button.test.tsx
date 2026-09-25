import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {isChatOpen} from './modal_state';
import SidebarButton, {ASK_GROK_LABEL} from './sidebar_button';

describe('SidebarButton', () => {
    test('renders Ask Grok label', () => {
        render(<SidebarButton/>);
        expect(screen.getByRole('button', {name: ASK_GROK_LABEL})).toBeInTheDocument();
    });

    test('click opens the chat modal', async () => {
        render(<SidebarButton/>);
        await userEvent.click(screen.getByRole('button', {name: ASK_GROK_LABEL}));
        expect(isChatOpen()).toBe(true);
    });
});
