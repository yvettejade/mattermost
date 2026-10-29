// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import HeaderIconWrapper from 'components/channel_header/components/header_icon_wrapper';
import MentionsIcon from 'components/widgets/icons/mentions_icon';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

describe('components/channel_header/components/HeaderIconWrapper', () => {
    const mentionsIcon = (
        <MentionsIcon
            className='icon icon__mentions'
            aria-hidden='true'
        />
    );

    const baseProps = {
        children: mentionsIcon,
        buttonClass: 'button_class',
        buttonId: 'button_id',
        onClick: jest.fn(),
        tooltip: 'Recent mentions',
    };

    test('should be accessible', async () => {
        renderWithContext(
            <HeaderIconWrapper
                {...baseProps}
            />,
        );

        expect(screen.getByLabelText('Recent mentions')).toBeVisible();
        expect(screen.queryByText('Recent mentions')).not.toBeInTheDocument();

        await userEvent.hover(screen.getByLabelText('Recent mentions'));

        await waitFor(() => {
            expect(screen.queryByText('Recent mentions')).toBeInTheDocument();
        });
    });

    test('should show the shortcut in its tooltip', async () => {
        renderWithContext(
            <HeaderIconWrapper
                {...baseProps}
                tooltipShortcut={{default: ['a', 'b', 'c']}}
            />,
        );

        expect(screen.getByLabelText('Recent mentions')).toBeVisible();
        expect(screen.queryByText('Recent mentions')).not.toBeInTheDocument();
        expect(screen.queryByText('a')).not.toBeInTheDocument();
        expect(screen.queryByText('b')).not.toBeInTheDocument();
        expect(screen.queryByText('c')).not.toBeInTheDocument();

        await userEvent.hover(screen.getByLabelText('Recent mentions'));

        await waitFor(() => {
            expect(screen.queryByText('Recent mentions')).toBeInTheDocument();

            expect(screen.queryByText('a')).toBeVisible();
            expect(screen.queryByText('b')).toBeVisible();
            expect(screen.queryByText('c')).toBeVisible();
        });
    });

    test('should not mark a plain icon as a popup trigger', () => {
        renderWithContext(
            <HeaderIconWrapper
                {...baseProps}
            />,
        );

        const button = screen.getByRole('button', {name: 'Recent mentions'});
        expect(button).not.toHaveAttribute('aria-haspopup');
        expect(button).not.toHaveAttribute('aria-expanded');
        expect(button).not.toHaveAttribute('aria-controls');
    });

    test('should describe a closed popover and show its tooltip', async () => {
        renderWithContext(
            <HeaderIconWrapper
                {...baseProps}
                popover={{id: 'popover_id', isOpen: false}}
            />,
        );

        const button = screen.getByRole('button', {name: 'Recent mentions'});
        expect(button).toHaveAttribute('aria-haspopup', 'dialog');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).not.toHaveAttribute('aria-controls');

        await userEvent.hover(button);

        await waitFor(() => {
            expect(screen.queryByText('Recent mentions')).toBeInTheDocument();
        });
    });

    test('should describe an open popover, keep its name, and hide its tooltip', async () => {
        renderWithContext(
            <HeaderIconWrapper
                {...baseProps}
                popover={{id: 'popover_id', isOpen: true}}
            />,
        );

        const button = screen.getByRole('button', {name: 'Recent mentions'});
        expect(button).toHaveAttribute('aria-haspopup', 'dialog');
        expect(button).toHaveAttribute('aria-expanded', 'true');
        expect(button).toHaveAttribute('aria-controls', 'popover_id');

        await userEvent.hover(button);

        await expect(waitFor(() => {
            expect(screen.queryByText('Recent mentions')).toBeInTheDocument();
        }, {timeout: 1000})).rejects.toThrow();
    });

    test('should forward its ref to the button', () => {
        const ref = React.createRef<HTMLButtonElement>();

        renderWithContext(
            <HeaderIconWrapper
                {...baseProps}
                ref={ref}
            />,
        );

        expect(ref.current).toBe(screen.getByRole('button', {name: 'Recent mentions'}));
    });
});
