// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import {resetEverydayMoneyState} from './store';
import type {EverydayMoneyState} from './types';

type Props = {
    onStateChange: (state: EverydayMoneyState) => void;
};

export default function Settings({onStateChange}: Props) {
    const handleReset = useCallback(() => {
        onStateChange(resetEverydayMoneyState());
    }, [onStateChange]);

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
            <p className='Online__muted'>
                <FormattedMessage
                    id='online.settings.reset.help'
                    defaultMessage='Reset restores seeded balances and clears any Rapid Save goal.'
                />
            </p>
            <div className='Online__actions'>
                <Button
                    type='button'
                    emphasis='tertiary'
                    onClick={handleReset}
                >
                    <FormattedMessage
                        id='online.settings.reset'
                        defaultMessage='Reset demo data'
                    />
                </Button>
            </div>
        </section>
    );
}
