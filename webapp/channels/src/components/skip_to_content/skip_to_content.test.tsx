// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SkipToContent, {MAIN_CONTENT_ID} from './skip_to_content';

describe('components/skip_to_content/SkipToContent', () => {
    test('should render as the first tab stop and become visible on focus', async () => {
        renderWithContext(
            <>
                <SkipToContent/>
                <a href='/header'>{'Header'}</a>
                <main
                    id={MAIN_CONTENT_ID}
                    tabIndex={-1}
                >
                    {'Content'}
                </main>
            </>,
        );

        const skipLink = screen.getByRole('link', {name: 'Skip to main content'});
        expect(skipLink).toHaveAttribute('href', `#${MAIN_CONTENT_ID}`);
        expect(skipLink).toHaveClass('SkipToContent');

        await userEvent.tab();
        expect(skipLink).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByRole('link', {name: 'Header'})).toHaveFocus();
    });

    test('should move keyboard focus to main content instead of only hash-scrolling', async () => {
        renderWithContext(
            <>
                <SkipToContent/>
                <a href='/header'>{'Header'}</a>
                <main
                    id={MAIN_CONTENT_ID}
                    tabIndex={-1}
                >
                    {'Content'}
                </main>
            </>,
        );

        await userEvent.click(screen.getByRole('link', {name: 'Skip to main content'}));

        expect(document.getElementById(MAIN_CONTENT_ID)).toHaveFocus();
        expect(window.location.hash).not.toBe(`#${MAIN_CONTENT_ID}`);
    });

    test('should focus an equivalent main landmark when id is missing', async () => {
        renderWithContext(
            <>
                <SkipToContent/>
                <main tabIndex={-1}>
                    {'Fallback main'}
                </main>
            </>,
        );

        await userEvent.click(screen.getByRole('link', {name: 'Skip to main content'}));

        expect(screen.getByRole('main')).toHaveFocus();
    });
});
