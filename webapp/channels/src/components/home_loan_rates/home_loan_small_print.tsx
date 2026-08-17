// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {HOME_LOAN_SMALL_PRINT} from './home_loan_rates';

import './home_loan_small_print.scss';

export default function HomeLoanSmallPrint() {
    return (
        <p
            className='HomeLoanSmallPrint'
            data-testid='home-loan-small-print'
        >
            <span data-testid='home-loan-establishment-fee'>{HOME_LOAN_SMALL_PRINT.establishmentFee}</span>
            {'. '}
            <span data-testid='home-loan-terms'>{HOME_LOAN_SMALL_PRINT.terms}</span>
        </p>
    );
}
