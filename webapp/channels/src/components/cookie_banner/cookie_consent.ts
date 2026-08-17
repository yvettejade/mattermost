// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const COOKIE_CONSENT_STORAGE_KEY = 'mm_cookie_consent';
export const COOKIE_CONSENT_ACCEPTED_ALL = 'accepted';

export type CookieConsent =
    | {kind: 'accepted_all'}
    | {kind: 'custom'; necessary: true; analytics: boolean};

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>;

export function serializeCookieConsent(consent: CookieConsent): string {
    if (consent.kind === 'accepted_all') {
        return COOKIE_CONSENT_ACCEPTED_ALL;
    }

    return JSON.stringify({necessary: true, analytics: consent.analytics});
}

export function parseCookieConsent(value: string | null): CookieConsent | null {
    if (!value) {
        return null;
    }

    if (value === COOKIE_CONSENT_ACCEPTED_ALL) {
        return {kind: 'accepted_all'};
    }

    try {
        const parsed: unknown = JSON.parse(value);
        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'analytics' in parsed &&
            typeof parsed.analytics === 'boolean'
        ) {
            return {kind: 'custom', necessary: true, analytics: parsed.analytics};
        }
    } catch {
        return null;
    }

    return null;
}

export function getCookieConsent(storage: ReadableStorage = localStorage): CookieConsent | null {
    return parseCookieConsent(storage.getItem(COOKIE_CONSENT_STORAGE_KEY));
}

export function hasCookieConsent(storage: ReadableStorage = localStorage): boolean {
    return getCookieConsent(storage) !== null;
}

export function writeAcceptedAll(storage: WritableStorage = localStorage): void {
    storage.setItem(COOKIE_CONSENT_STORAGE_KEY, serializeCookieConsent({kind: 'accepted_all'}));
}

export function writeCustomConsent(analytics: boolean, storage: WritableStorage = localStorage): void {
    storage.setItem(
        COOKIE_CONSENT_STORAGE_KEY,
        serializeCookieConsent({kind: 'custom', necessary: true, analytics}),
    );
}

export function clearCookieConsent(storage: WritableStorage = localStorage): void {
    storage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
}
