// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

import {
    formatForeignFromMinor,
    formatFxRate,
    formatNzdFromCents,
    quoteNzdToForeign,
} from './fx_quote';
import InternationalMoney from './international_money';

describe('components/international_money/InternationalMoney', () => {
    beforeEach(() => {
        (getHistory().push as jest.Mock).mockClear();
    });

    test('shows an indicative NZD to AUD quote from the shared calculator', () => {
        const quote = quoteNzdToForeign(100000, 'AUD');

        renderWithContext(<InternationalMoney/>);

        expect(screen.getByRole('heading', {name: 'International money'})).toBeInTheDocument();
        expect(screen.getByLabelText('Amount (NZD)')).toHaveValue('1000');
        expect(screen.getByLabelText('Currency')).toHaveValue('AUD');
        expect(screen.getByText(formatForeignFromMinor(quote.receiveMinorUnits, 'AUD'))).toBeInTheDocument();
        expect(screen.getByText(formatFxRate(quote.rate, 'AUD'))).toBeInTheDocument();
        expect(screen.getByText(formatNzdFromCents(quote.feeNzdCents))).toBeInTheDocument();
        expect(screen.getByText('This quote is indicative only. The rate is locked when you make the payment.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Log on to Internet Banking'})).toBeInTheDocument();
    });

    test('recalculates the receive amount when the currency changes', async () => {
        const usdQuote = quoteNzdToForeign(100000, 'USD');

        renderWithContext(<InternationalMoney/>);

        await userEvent.selectOptions(screen.getByLabelText('Currency'), 'USD');

        expect(screen.getByText(formatForeignFromMinor(usdQuote.receiveMinorUnits, 'USD'))).toBeInTheDocument();
        expect(screen.getByText(formatFxRate(usdQuote.rate, 'USD'))).toBeInTheDocument();
    });

    test('keeps the log on CTA after an invalid amount', async () => {
        renderWithContext(<InternationalMoney/>);

        await userEvent.clear(screen.getByLabelText('Amount (NZD)'));
        await userEvent.type(screen.getByLabelText('Amount (NZD)'), '5');

        expect(screen.getByText('Enter an amount greater than the transfer fee.')).toBeInTheDocument();
        expect(screen.queryByText('Recipient gets')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Log on to Internet Banking'})).toBeInTheDocument();
    });

    test('log on CTA goes to login', async () => {
        renderWithContext(<InternationalMoney/>);

        await userEvent.click(screen.getByRole('button', {name: 'Log on to Internet Banking'}));

        expect(getHistory().push).toHaveBeenCalledWith('/login');
    });
});
