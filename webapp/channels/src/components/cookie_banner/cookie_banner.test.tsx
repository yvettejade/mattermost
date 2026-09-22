// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import CookieBanner from './cookie_banner';
import {COOKIE_CONSENT_ACCEPTED_ALL, COOKIE_CONSENT_STORAGE_KEY} from './cookie_consent';

describe('components/cookie_banner/CookieBanner', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('shows the banner when no consent is stored', () => {
        renderWithContext(<CookieBanner/>);

        expect(screen.getByRole('dialog', {name: 'Cookies'})).toBeVisible();
        expect(screen.getByRole('button', {name: 'Manage cookies'})).toBeVisible();
        expect(screen.getByRole('button', {name: 'Accept all'})).toBeVisible();
        expect(screen.queryByTestId('cookie-banner-preferences')).not.toBeInTheDocument();
    });

    test('does not write the accept-all value when Manage cookies is clicked', async () => {
        renderWithContext(<CookieBanner/>);

        await userEvent.click(screen.getByRole('button', {name: 'Manage cookies'}));

        expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBeNull();
        expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).not.toBe(COOKIE_CONSENT_ACCEPTED_ALL);
        expect(screen.getByRole('dialog', {name: 'Cookies'})).toBeVisible();
        expect(screen.getByTestId('cookie-banner-preferences')).toBeVisible();
    });

    test('opens preferences with Necessary on and Analytics off', async () => {
        renderWithContext(<CookieBanner/>);

        await userEvent.click(screen.getByRole('button', {name: 'Manage cookies'}));

        const necessary = screen.getByRole('checkbox', {name: /Necessary/});
        const analytics = screen.getByRole('checkbox', {name: /Analytics/});

        expect(necessary).toBeChecked();
        expect(necessary).toBeDisabled();
        expect(analytics).not.toBeChecked();
        expect(analytics).toBeEnabled();
        expect(screen.getByRole('button', {name: 'Save'})).toBeVisible();
    });

    test('Save stores a custom choice that is not accept-all and hides the banner', async () => {
        renderWithContext(<CookieBanner/>);

        await userEvent.click(screen.getByRole('button', {name: 'Manage cookies'}));
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe(
            JSON.stringify({necessary: true, analytics: false}),
        );
        expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).not.toBe(COOKIE_CONSENT_ACCEPTED_ALL);
        expect(screen.queryByRole('dialog', {name: 'Cookies'})).not.toBeInTheDocument();
    });

    test('Accept all writes the accepted value and hides the banner', async () => {
        renderWithContext(<CookieBanner/>);

        await userEvent.click(screen.getByRole('button', {name: 'Accept all'}));

        expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe(COOKIE_CONSENT_ACCEPTED_ALL);
        expect(screen.queryByRole('dialog', {name: 'Cookies'})).not.toBeInTheDocument();
    });

    test('does not return after a stored choice until the key is reset', () => {
        window.localStorage.setItem(
            COOKIE_CONSENT_STORAGE_KEY,
            JSON.stringify({necessary: true, analytics: false}),
        );

        const {unmount} = renderWithContext(<CookieBanner/>);
        expect(screen.queryByRole('dialog', {name: 'Cookies'})).not.toBeInTheDocument();
        unmount();

        window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
        renderWithContext(<CookieBanner/>);
        expect(screen.getByRole('dialog', {name: 'Cookies'})).toBeVisible();
    });
});
