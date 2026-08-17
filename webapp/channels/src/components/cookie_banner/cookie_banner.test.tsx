// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import CookieBanner from './cookie_banner';
import {
    COOKIE_CONSENT_ACCEPTED_ALL,
    COOKIE_CONSENT_STORAGE_KEY,
    writeAcceptedAll,
    writeCustomConsent,
} from './cookie_consent';

describe('components/cookie_banner/CookieBanner', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('should render Accept all and Manage cookies when no consent is stored', () => {
        renderWithContext(<CookieBanner/>);

        expect(screen.getByTestId('cookie-banner')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Accept all'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Manage cookies'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });

    test('Manage cookies does not write the accept-all value', async () => {
        renderWithContext(<CookieBanner/>);

        await userEvent.click(screen.getByRole('button', {name: 'Manage cookies'}));

        expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBeNull();
        expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).not.toBe(COOKIE_CONSENT_ACCEPTED_ALL);
        expect(screen.getByTestId('cookie-banner')).toBeInTheDocument();
    });

    test('Manage cookies opens the preference panel with Necessary on and Analytics off', async () => {
        renderWithContext(<CookieBanner/>);

        await userEvent.click(screen.getByRole('button', {name: 'Manage cookies'}));

        const necessary = screen.getByTestId('cookie-banner-necessary');
        const analytics = screen.getByTestId('cookie-banner-analytics');

        expect(necessary).toBeChecked();
        expect(necessary).toBeDisabled();
        expect(analytics).not.toBeChecked();
        expect(analytics).toBeEnabled();
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Accept all'})).not.toBeInTheDocument();
    });

    test('Accept all persists accepted-all and hides the banner', async () => {
        renderWithContext(<CookieBanner/>);

        await userEvent.click(screen.getByRole('button', {name: 'Accept all'}));

        expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe(COOKIE_CONSENT_ACCEPTED_ALL);
        expect(screen.queryByTestId('cookie-banner')).not.toBeInTheDocument();
    });

    test('Save stores a custom choice and hides the banner until reset', async () => {
        const {unmount} = renderWithContext(<CookieBanner/>);

        await userEvent.click(screen.getByRole('button', {name: 'Manage cookies'}));
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        const stored = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
        expect(stored).not.toBe(COOKIE_CONSENT_ACCEPTED_ALL);
        expect(stored).toContain('"choice":"custom"');
        expect(stored).toContain('"analytics":false');
        expect(screen.queryByTestId('cookie-banner')).not.toBeInTheDocument();

        unmount();
        renderWithContext(<CookieBanner/>);
        expect(screen.queryByTestId('cookie-banner')).not.toBeInTheDocument();
    });

    test('saving with analytics off is distinguishable from Accept all', async () => {
        renderWithContext(<CookieBanner/>);

        await userEvent.click(screen.getByRole('button', {name: 'Manage cookies'}));
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).not.toBe(COOKIE_CONSENT_ACCEPTED_ALL);
    });

    test('does not render when accept-all consent is already stored', () => {
        writeAcceptedAll();

        renderWithContext(<CookieBanner/>);

        expect(screen.queryByTestId('cookie-banner')).not.toBeInTheDocument();
    });

    test('does not render when a custom choice is already stored', () => {
        writeCustomConsent(false);

        renderWithContext(<CookieBanner/>);

        expect(screen.queryByTestId('cookie-banner')).not.toBeInTheDocument();
    });
});
