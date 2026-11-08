// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useHistory} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {
    FX_CURRENCIES,
    formatForeignFromMinor,
    formatFxRate,
    formatNzdFromCents,
    isFxCurrency,
    quoteFromAmountInput,
} from './fx_quote';
import type {FxCurrency} from './fx_quote';

import './international_money.scss';

const ERROR_MESSAGES: Record<'invalid_amount' | 'amount_too_small', {id: string; defaultMessage: string}> = {
    invalid_amount: {
        id: 'international_money.error.invalid_amount',
        defaultMessage: 'Enter an amount greater than zero, using up to two decimal places.',
    },
    amount_too_small: {
        id: 'international_money.error.amount_too_small',
        defaultMessage: 'Enter an amount greater than the transfer fee.',
    },
};

export default function InternationalMoney() {
    const history = useHistory();
    const [amount, setAmount] = useState('1000');
    const [currency, setCurrency] = useState<FxCurrency>('AUD');

    const result = useMemo(() => quoteFromAmountInput(amount, currency), [amount, currency]);

    const handleAmountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(event.target.value);
    }, []);

    const handleCurrencyChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        if (isFxCurrency(event.target.value)) {
            setCurrency(event.target.value);
        }
    }, []);

    const handleLogOn = useCallback(() => {
        history.push('/login');
    }, [history]);

    return (
        <div className='InternationalMoney'>
            <div className='InternationalMoney__card'>
                <h1 className='InternationalMoney__heading'>
                    <FormattedMessage
                        id='international_money.heading'
                        defaultMessage='International money'
                    />
                </h1>
                <p className='InternationalMoney__subtitle'>
                    <FormattedMessage
                        id='international_money.subtitle'
                        defaultMessage='See an indicative NZD to foreign amount before you log on.'
                    />
                </p>
                <form
                    className='InternationalMoney__form'
                    aria-labelledby='international-money-quote-heading'
                    onSubmit={(event) => event.preventDefault()}
                >
                    <h2
                        id='international-money-quote-heading'
                        className='InternationalMoney__sectionTitle'
                    >
                        <FormattedMessage
                            id='international_money.quote_heading'
                            defaultMessage='Indicative quote'
                        />
                    </h2>
                    <label
                        className='InternationalMoney__field'
                        htmlFor='international-money-amount'
                    >
                        <span className='InternationalMoney__label'>
                            <FormattedMessage
                                id='international_money.amount'
                                defaultMessage='Amount (NZD)'
                            />
                        </span>
                        <input
                            id='international-money-amount'
                            className='InternationalMoney__input'
                            type='text'
                            inputMode='decimal'
                            autoComplete='off'
                            value={amount}
                            onChange={handleAmountChange}
                        />
                    </label>
                    <label
                        className='InternationalMoney__field'
                        htmlFor='international-money-currency'
                    >
                        <span className='InternationalMoney__label'>
                            <FormattedMessage
                                id='international_money.currency'
                                defaultMessage='Currency'
                            />
                        </span>
                        <select
                            id='international-money-currency'
                            className='InternationalMoney__input'
                            value={currency}
                            onChange={handleCurrencyChange}
                        >
                            {FX_CURRENCIES.map((code) => (
                                <option
                                    key={code}
                                    value={code}
                                >
                                    {code}
                                </option>
                            ))}
                        </select>
                    </label>
                </form>
                {result.ok ? (
                    <dl
                        className='InternationalMoney__quote'
                        aria-live='polite'
                    >
                        <div className='InternationalMoney__quoteRow'>
                            <dt>
                                <FormattedMessage
                                    id='international_money.receive'
                                    defaultMessage='Recipient gets'
                                />
                            </dt>
                            <dd>{formatForeignFromMinor(result.quote.receiveMinorUnits, result.quote.currency)}</dd>
                        </div>
                        <div className='InternationalMoney__quoteRow'>
                            <dt>
                                <FormattedMessage
                                    id='international_money.rate'
                                    defaultMessage='Exchange rate'
                                />
                            </dt>
                            <dd>{formatFxRate(result.quote.rate, result.quote.currency)}</dd>
                        </div>
                        <div className='InternationalMoney__quoteRow'>
                            <dt>
                                <FormattedMessage
                                    id='international_money.fee'
                                    defaultMessage='Transfer fee'
                                />
                            </dt>
                            <dd>{formatNzdFromCents(result.quote.feeNzdCents)}</dd>
                        </div>
                    </dl>
                ) : (
                    <p
                        className='InternationalMoney__error'
                        role='alert'
                    >
                        <FormattedMessage {...ERROR_MESSAGES[result.error]}/>
                    </p>
                )}
                <p className='InternationalMoney__disclaimer'>
                    <FormattedMessage
                        id='international_money.disclaimer'
                        defaultMessage='This quote is indicative only. The rate is locked when you make the payment.'
                    />
                </p>
                <Button
                    className='InternationalMoney__logOn'
                    onClick={handleLogOn}
                >
                    <FormattedMessage
                        id='international_money.log_on'
                        defaultMessage='Log on to Internet Banking'
                    />
                </Button>
            </div>
        </div>
    );
}
