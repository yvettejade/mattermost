// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import {saveEverydayMoneySettings} from './store';
import type {EverydayMoneyState} from './types';

type Props = {
    state: EverydayMoneyState;
    onStateChange: (state: EverydayMoneyState) => void;
};

export default function Settings({state, onStateChange}: Props) {
    const handleHideBalances = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        onStateChange(saveEverydayMoneySettings({
            ...state.settings,
            hideBalances: event.target.checked,
        }));
    }, [onStateChange, state.settings]);

    const handlePaymentAlerts = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        onStateChange(saveEverydayMoneySettings({
            ...state.settings,
            paymentAlerts: event.target.checked,
        }));
    }, [onStateChange, state.settings]);

    return (
        <section
            className='Online__form'
            aria-labelledby='online-settings-heading'
        >
            <h3
                id='online-settings-heading'
                className='Online__sectionTitle'
            >
                <FormattedMessage
                    id='online.settings.form'
                    defaultMessage='Internet Banking settings'
                />
            </h3>
            <label className='Online__toggle'>
                <input
                    type='checkbox'
                    checked={state.settings.hideBalances}
                    onChange={handleHideBalances}
                />
                <FormattedMessage
                    id='online.settings.hide_balances'
                    defaultMessage='Hide balances on the accounts overview'
                />
            </label>
            <label className='Online__toggle'>
                <input
                    type='checkbox'
                    checked={state.settings.paymentAlerts}
                    onChange={handlePaymentAlerts}
                />
                <FormattedMessage
                    id='online.settings.payment_alerts'
                    defaultMessage='Alert me after a transfer or pay anyone payment'
                />
            </label>
        </section>
    );
}
