// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {
    ChannelHeaderTextPopover,
    checkIfTextIsOverflowing,
    HEADER_TEXT_COLLAPSED_LINE_COUNT,
    HEADER_TEXT_COLLAPSED_MAX_HEIGHT_PX,
    HEADER_TEXT_LINE_HEIGHT_PX,
} from './channel_header_text_popover';

describe('checkIfTextIsOverflowing', () => {
    test('treats headers with two or more newlines as overflowing', () => {
        expect(checkIfTextIsOverflowing(null, 'line one\nline two\nline three')).toBe(true);
    });

    test('does not treat a single newline as overflowing without a measured element', () => {
        expect(checkIfTextIsOverflowing(null, 'line one\nline two')).toBe(false);
    });

    test('does not treat short single-line text as overflowing without a measured element', () => {
        expect(checkIfTextIsOverflowing(null, 'Short header')).toBe(false);
    });

    test('treats content taller than the two-line clamp as overflowing', () => {
        const elem = {
            scrollHeight: HEADER_TEXT_COLLAPSED_MAX_HEIGHT_PX + 8,
            clientHeight: HEADER_TEXT_COLLAPSED_MAX_HEIGHT_PX,
            scrollWidth: 100,
            clientWidth: 100,
        } as HTMLDivElement;

        expect(checkIfTextIsOverflowing(elem, 'A long wrapped header')).toBe(true);
    });

    test('treats horizontally overflowing single-line text as overflowing', () => {
        const elem = {
            scrollHeight: HEADER_TEXT_LINE_HEIGHT_PX,
            clientHeight: HEADER_TEXT_LINE_HEIGHT_PX,
            scrollWidth: 400,
            clientWidth: 120,
        } as HTMLDivElement;

        expect(checkIfTextIsOverflowing(elem, 'A very long header that does not fit')).toBe(true);
    });

    test('collapsed line count is two', () => {
        expect(HEADER_TEXT_COLLAPSED_LINE_COUNT).toBe(2);
    });
});

describe('ChannelHeaderTextPopover', () => {
    test('renders header text without a toggle when the header is short', () => {
        renderWithContext(
            <ChannelHeaderTextPopover text='Short header'/>,
        );

        expect(screen.getByText('Short header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Show more'})).not.toBeInTheDocument();
    });

    test('shows a truncated state with Show more when the header exceeds two lines', () => {
        renderWithContext(
            <ChannelHeaderTextPopover text={'Line one\nLine two\nLine three'}/>,
        );

        const toggle = screen.getByRole('button', {name: 'Show more'});
        expect(toggle).toBeInTheDocument();
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(document.querySelector('.header-description__text')).not.toHaveClass('expanded');
    });

    test('expands to the full header and can collapse again', async () => {
        renderWithContext(
            <ChannelHeaderTextPopover text={'Line one\nLine two\nLine three'}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Show more'}));

        const collapse = screen.getByRole('button', {name: 'Show less'});
        expect(collapse).toHaveAttribute('aria-expanded', 'true');
        expect(document.querySelector('.header-description__text')).toHaveClass('expanded');

        await userEvent.click(collapse);

        expect(screen.getByRole('button', {name: 'Show more'})).toHaveAttribute('aria-expanded', 'false');
        expect(document.querySelector('.header-description__text')).not.toHaveClass('expanded');
    });

    test('resets to the truncated state when the header text changes', async () => {
        const {rerender} = renderWithContext(
            <ChannelHeaderTextPopover text={'Line one\nLine two\nLine three'}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Show more'}));
        expect(screen.getByRole('button', {name: 'Show less'})).toBeInTheDocument();

        rerender(
            <ChannelHeaderTextPopover text={'Another line\nAnother line\nAnother line'}/>,
        );

        expect(screen.getByRole('button', {name: 'Show more'})).toHaveAttribute('aria-expanded', 'false');
        expect(document.querySelector('.header-description__text')).not.toHaveClass('expanded');
    });
});
