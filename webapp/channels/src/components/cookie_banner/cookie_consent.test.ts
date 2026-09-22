// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    COOKIE_CONSENT_ACCEPTED_ALL,
    COOKIE_CONSENT_STORAGE_KEY,
    clearCookieConsent,
    hasCookieConsent,
    readCookieConsent,
    writeAcceptedAll,
    writeCustomConsent,
} from './cookie_consent';

describe('cookie_consent', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('starts with no stored consent', () => {
        expect(readCookieConsent()).toBeNull();
        expect(hasCookieConsent()).toBe(false);
        expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBeNull();
    });

    test('Accept all persists the accept-all value', () => {
        writeAcceptedAll();

        expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe(COOKIE_CONSENT_ACCEPTED_ALL);
        expect(readCookieConsent()).toEqual({
            choice: 'accepted-all',
            necessary: true,
            analytics: true,
        });
    });

    test('rejecting analytics is distinguishable from Accept all in storage', () => {
        writeCustomConsent(false);

        expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).not.toBe(COOKIE_CONSENT_ACCEPTED_ALL);
        expect(readCookieConsent()).toEqual({
            choice: 'custom',
            necessary: true,
            analytics: false,
        });
    });

    test('saving analytics on is still distinguishable from Accept all', () => {
        writeCustomConsent(true);

        expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).not.toBe(COOKIE_CONSENT_ACCEPTED_ALL);
        expect(readCookieConsent()).toEqual({
            choice: 'custom',
            necessary: true,
            analytics: true,
        });
    });

    test('clearCookieConsent removes the stored choice', () => {
        writeAcceptedAll();
        clearCookieConsent();

        expect(readCookieConsent()).toBeNull();
        expect(hasCookieConsent()).toBe(false);
    });
});
