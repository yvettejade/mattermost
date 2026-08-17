// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    COOKIE_CONSENT_ACCEPTED_ALL,
    COOKIE_CONSENT_STORAGE_KEY,
    getCookieConsent,
    hasCookieConsent,
    parseCookieConsent,
    serializeCookieConsent,
    writeAcceptedAll,
    writeCustomConsent,
} from './cookie_consent';

describe('cookie_consent', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('serializes accept-all as a distinct stored value', () => {
        expect(serializeCookieConsent({kind: 'accepted_all'})).toBe(COOKIE_CONSENT_ACCEPTED_ALL);
        expect(serializeCookieConsent({kind: 'custom', necessary: true, analytics: false})).not.toBe(
            COOKIE_CONSENT_ACCEPTED_ALL,
        );
        expect(serializeCookieConsent({kind: 'custom', necessary: true, analytics: true})).not.toBe(
            COOKIE_CONSENT_ACCEPTED_ALL,
        );
    });

    test('stores a custom choice that is distinguishable from accept-all', () => {
        writeCustomConsent(false);

        expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).not.toBe(COOKIE_CONSENT_ACCEPTED_ALL);
        expect(getCookieConsent()).toEqual({kind: 'custom', necessary: true, analytics: false});
        expect(hasCookieConsent()).toBe(true);
    });

    test('stores accept-all as the accepted value', () => {
        writeAcceptedAll();

        expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe(COOKIE_CONSENT_ACCEPTED_ALL);
        expect(getCookieConsent()).toEqual({kind: 'accepted_all'});
    });

    test('parses unknown storage as no consent', () => {
        expect(parseCookieConsent(null)).toBeNull();
        expect(parseCookieConsent('nope')).toBeNull();
        expect(hasCookieConsent()).toBe(false);
    });
});
