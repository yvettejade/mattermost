// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import {
    hasCookieConsent,
    writeAcceptedAll,
    writeCustomConsent,
} from './cookie_consent';

import './cookie_banner.scss';

const CookieBanner = () => {
    const [visible, setVisible] = useState(() => !hasCookieConsent());
    const [managing, setManaging] = useState(false);
    const [analytics, setAnalytics] = useState(false);

    const handleAcceptAll = useCallback(() => {
        writeAcceptedAll();
        setVisible(false);
    }, []);

    const handleManage = useCallback(() => {
        setManaging(true);
    }, []);

    const handleSave = useCallback(() => {
        writeCustomConsent(analytics);
        setVisible(false);
    }, [analytics]);

    if (!visible) {
        return null;
    }

    return (
        <aside
            className='CookieBanner'
            role='dialog'
            aria-modal='false'
            aria-labelledby='cookie-banner-title'
            aria-describedby='cookie-banner-message'
        >
            <div className='CookieBanner__content'>
                <h2
                    id='cookie-banner-title'
                    className='CookieBanner__title'
                >
                    <FormattedMessage
                        id='cookie_banner.title'
                        defaultMessage='Cookies'
                    />
                </h2>
                <p
                    id='cookie-banner-message'
                    className='CookieBanner__message'
                >
                    <FormattedMessage
                        id='cookie_banner.message'
                        defaultMessage='We use cookies to run this site. Necessary cookies are always on. Analytics cookies are optional.'
                    />
                </p>
                {managing && (
                    <div
                        className='CookieBanner__preferences'
                        data-testid='cookie-banner-preferences'
                    >
                        <p className='CookieBanner__preferencesTitle'>
                            <FormattedMessage
                                id='cookie_banner.preferences'
                                defaultMessage='Cookie preferences'
                            />
                        </p>
                        <div className='CookieBanner__choice'>
                            <input
                                id='cookie-banner-necessary'
                                type='checkbox'
                                checked={true}
                                disabled={true}
                                aria-describedby='cookie-banner-necessary-desc'
                            />
                            <label htmlFor='cookie-banner-necessary'>
                                <span className='CookieBanner__choiceName'>
                                    <FormattedMessage
                                        id='cookie_banner.necessary'
                                        defaultMessage='Necessary'
                                    />
                                </span>
                                <span
                                    id='cookie-banner-necessary-desc'
                                    className='CookieBanner__choiceDesc'
                                >
                                    <FormattedMessage
                                        id='cookie_banner.necessary.description'
                                        defaultMessage='Required for the site to work. Always on.'
                                    />
                                </span>
                            </label>
                        </div>
                        <div className='CookieBanner__choice'>
                            <input
                                id='cookie-banner-analytics'
                                type='checkbox'
                                checked={analytics}
                                onChange={(event) => setAnalytics(event.target.checked)}
                                aria-describedby='cookie-banner-analytics-desc'
                            />
                            <label htmlFor='cookie-banner-analytics'>
                                <span className='CookieBanner__choiceName'>
                                    <FormattedMessage
                                        id='cookie_banner.analytics'
                                        defaultMessage='Analytics'
                                    />
                                </span>
                                <span
                                    id='cookie-banner-analytics-desc'
                                    className='CookieBanner__choiceDesc'
                                >
                                    <FormattedMessage
                                        id='cookie_banner.analytics.description'
                                        defaultMessage='Help us understand how the site is used. Off by default.'
                                    />
                                </span>
                            </label>
                        </div>
                    </div>
                )}
            </div>
            <div className='CookieBanner__actions'>
                {managing ? (
                    <Button
                        onClick={handleSave}
                    >
                        <FormattedMessage
                            id='cookie_banner.save'
                            defaultMessage='Save'
                        />
                    </Button>
                ) : (
                    <Button
                        emphasis='tertiary'
                        onClick={handleManage}
                    >
                        <FormattedMessage
                            id='cookie_banner.manage'
                            defaultMessage='Manage cookies'
                        />
                    </Button>
                )}
                <Button
                    onClick={handleAcceptAll}
                >
                    <FormattedMessage
                        id='cookie_banner.acceptAll'
                        defaultMessage='Accept all'
                    />
                </Button>
            </div>
        </aside>
    );
};

export default CookieBanner;
