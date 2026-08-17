// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export {default} from './cookie_banner';
export {
    COOKIE_CONSENT_ACCEPTED_ALL,
    COOKIE_CONSENT_STORAGE_KEY,
    clearCookieConsent,
    hasCookieConsent,
    readCookieConsent,
    writeAcceptedAll,
    writeCustomConsent,
} from './cookie_consent';
export type {CookieConsent} from './cookie_consent';
