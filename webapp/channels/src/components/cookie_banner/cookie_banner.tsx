// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import {
    readCookieConsent,
    writeAcceptedAll,
    writeCustomConsent,
} from './cookie_consent';

import './cookie_banner.scss';

const CookieBanner = () => {
    const [consent, setConsent] = useState(() => readCookieConsent());
    const [managing, setManaging] = useState(false);
    const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

    const handleAcceptAll = useCallback(() => {
        writeAcceptedAll();
        setConsent(readCookieConsent());
    }, []);

    const handleManage = useCallback(() => {
        setManaging(true);
    }, []);

    const handleSave = useCallback(() => {
        writeCustomConsent(analyticsEnabled);
        setConsent(readCookieConsent());
    }, [analyticsEnabled]);

    if (consent) {
        return null;
    }

    return (
        <section
            className='CookieBanner'
            role='dialog'
            aria-labelledby='cookie-banner-title'
            aria-describedby='cookie-banner-description'
            data-testid='cookie-banner'
        >
            <div className='CookieBanner__content'>
                <h2
                    id='cookie-banner-title'
                    className='CookieBanner__title'
                >
                    <FormattedMessage
                        id='cookieBanner.title'
                        defaultMessage='Cookies'
                    />
                </h2>
                <p
                    id='cookie-banner-description'
                    className='CookieBanner__message'
                >
                    <FormattedMessage
                        id='cookieBanner.message'
                        defaultMessage='We use cookies to run this site. Necessary cookies are always on. Analytics cookies are optional.'
                    />
                </p>
                {managing && (
                    <fieldset className='CookieBanner__preferences'>
                        <legend className='CookieBanner__legend'>
                            <FormattedMessage
                                id='cookieBanner.preferences'
                                defaultMessage='Cookie preferences'
                            />
                        </legend>
                        <label className='CookieBanner__option'>
                            <input
                                type='checkbox'
                                checked={true}
                                disabled={true}
                                data-testid='cookie-banner-necessary'
                            />
                            <span>
                                <FormattedMessage
                                    id='cookieBanner.necessary'
                                    defaultMessage='Necessary'
                                />
                            </span>
                        </label>
                        <label className='CookieBanner__option'>
                            <input
                                type='checkbox'
                                checked={analyticsEnabled}
                                onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                                data-testid='cookie-banner-analytics'
                            />
                            <span>
                                <FormattedMessage
                                    id='cookieBanner.analytics'
                                    defaultMessage='Analytics'
                                />
                            </span>
                        </label>
                    </fieldset>
                )}
            </div>
            <div className='CookieBanner__actions'>
                {managing ? (
                    <Button
                        onClick={handleSave}
                        data-testid='cookie-banner-save'
                    >
                        <FormattedMessage
                            id='cookieBanner.save'
                            defaultMessage='Save'
                        />
                    </Button>
                ) : (
                    <>
                        <Button
                            onClick={handleAcceptAll}
                            data-testid='cookie-banner-accept-all'
                        >
                            <FormattedMessage
                                id='cookieBanner.acceptAll'
                                defaultMessage='Accept all'
                            />
                        </Button>
                        <Button
                            emphasis='tertiary'
                            onClick={handleManage}
                            data-testid='cookie-banner-manage'
                        >
                            <FormattedMessage
                                id='cookieBanner.manage'
                                defaultMessage='Manage cookies'
                            />
                        </Button>
                    </>
                )}
            </div>
        </section>
    );
};

export default CookieBanner;
