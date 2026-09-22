// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const COOKIE_CONSENT_STORAGE_KEY = 'mm_cookie_consent';

// Single-flag value written by Accept all. Manage cookies must never persist this.
export const COOKIE_CONSENT_ACCEPTED_ALL = 'accepted';

export type AcceptedAllCookieConsent = {
    choice: 'accepted-all';
    necessary: true;
    analytics: true;
};

export type CustomCookieConsent = {
    choice: 'custom';
    necessary: true;
    analytics: boolean;
};

export type CookieConsent = AcceptedAllCookieConsent | CustomCookieConsent;

const acceptedAllConsent: AcceptedAllCookieConsent = {
    choice: 'accepted-all',
    necessary: true,
    analytics: true,
};

function isCustomConsent(value: unknown): value is CustomCookieConsent {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    if (!('choice' in value) || value.choice !== 'custom') {
        return false;
    }
    if (!('necessary' in value) || value.necessary !== true) {
        return false;
    }
    if (!('analytics' in value) || typeof value.analytics !== 'boolean') {
        return false;
    }
    return true;
}

export function readCookieConsent(): CookieConsent | null {
    try {
        const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        if (raw === COOKIE_CONSENT_ACCEPTED_ALL) {
            return acceptedAllConsent;
        }

        const parsed: unknown = JSON.parse(raw);
        if (!isCustomConsent(parsed)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function hasCookieConsent(): boolean {
    return readCookieConsent() !== null;
}

export function writeAcceptedAll(): void {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, COOKIE_CONSENT_ACCEPTED_ALL);
}

export function writeCustomConsent(analytics: boolean): void {
    const consent: CustomCookieConsent = {
        choice: 'custom',
        necessary: true,
        analytics,
    };
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent));
}

export function clearCookieConsent(): void {
    localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
}
