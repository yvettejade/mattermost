// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, FormattedNumber, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import {
    applyOwnTransfer,
    formatNzd,
    getAccountBalance,
    PAY_ANYONE_CURRENCY,
    PAY_FROM_ACCOUNTS,
    paymentStatus,
    todayInAuckland,
} from './payments';

function parseAmount(value: string): number {
    return Number.parseFloat(value);
}

export default function Transfer() {
    const {formatMessage} = useIntl();
    const [fromAccountId, setFromAccountId] = useState(PAY_FROM_ACCOUNTS[0].id);
    const [toAccountId, setToAccountId] = useState(PAY_FROM_ACCOUNTS[1].id);
    const [amount, setAmount] = useState('');
    const [when, setWhen] = useState('');
    const [reviewing, setReviewing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [balances, setBalances] = useState<Record<string, number>>(() => (
        Object.fromEntries(PAY_FROM_ACCOUNTS.map((account) => [account.id, getAccountBalance(account.id)]))
    ));

    const fromAccount = useMemo(
        () => PAY_FROM_ACCOUNTS.find((account) => account.id === fromAccountId) ?? PAY_FROM_ACCOUNTS[0],
        [fromAccountId],
    );
    const toAccount = useMemo(
        () => PAY_FROM_ACCOUNTS.find((account) => account.id === toAccountId) ?? PAY_FROM_ACCOUNTS[1],
        [toAccountId],
    );
    const available = balances[fromAccount.id] ?? fromAccount.available;

    const resetStatus = useCallback(() => {
        setReviewing(false);
        setError(null);
        setSuccess(null);
    }, []);

    const handleFromChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const next = event.target.value;
        setFromAccountId(next);
        resetStatus();
        if (next === toAccountId) {
            const other = PAY_FROM_ACCOUNTS.find((account) => account.id !== next);
            if (other) {
                setToAccountId(other.id);
            }
        }
    }, [resetStatus, toAccountId]);

    const handleToChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        setToAccountId(event.target.value);
        resetStatus();
    }, [resetStatus]);

    const handleAmountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(event.target.value);
        resetStatus();
    }, [resetStatus]);

    const handleWhenChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setWhen(event.target.value);
        resetStatus();
    }, [resetStatus]);

    const handleReview = useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (fromAccountId === toAccountId) {
            setError(formatMessage({
                id: 'online.transfer.error.same_account',
                defaultMessage: 'Choose two different accounts.',
            }));
            setReviewing(false);
            return;
        }
        const parsed = parseAmount(amount);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            setError(formatMessage({
                id: 'online.transfer.error.invalid_amount',
                defaultMessage: 'Enter an amount greater than zero.',
            }));
            setReviewing(false);
            return;
        }
        if (paymentStatus(when) === 'sent' && parsed > available) {
            setError(formatMessage({
                id: 'online.transfer.error.insufficient',
                defaultMessage: 'That amount is more than the available balance.',
            }));
            setReviewing(false);
            return;
        }
        setError(null);
        setSuccess(null);
        setReviewing(true);
    }, [amount, available, formatMessage, fromAccountId, toAccountId, when]);

    const handleConfirm = useCallback(() => {
        const parsed = parseAmount(amount);
        const applied = applyOwnTransfer({
            fromAccountId,
            toAccountId,
            amount: parsed,
            when,
        });
        if (!applied.ok) {
            setSuccess(null);
            setReviewing(false);
            setError(formatMessage({
                id: 'online.transfer.error.insufficient',
                defaultMessage: 'That amount is more than the available balance.',
            }));
            return;
        }

        setBalances(applied.state.balances);
        setAmount('');
        setWhen('');
        setReviewing(false);
        setError(null);
        setSuccess(applied.transfer.status === 'scheduled' ? formatMessage(
            {
                id: 'online.transfer.success.scheduled',
                defaultMessage: 'Transfer of {amount} from {from} to {to} is scheduled for {date}.',
            },
            {
                amount: formatNzd(applied.transfer.amount),
                from: fromAccount.name.defaultMessage,
                to: toAccount.name.defaultMessage,
                date: applied.transfer.when,
            },
        ) : formatMessage(
            {
                id: 'online.transfer.success',
                defaultMessage: 'Transferred {amount} from {from} to {to}.',
            },
            {
                amount: formatNzd(applied.transfer.amount),
                from: fromAccount.name.defaultMessage,
                to: toAccount.name.defaultMessage,
            },
        ));
    }, [amount, formatMessage, fromAccount.name.defaultMessage, fromAccountId, toAccount.name.defaultMessage, toAccountId, when]);

    const reviewAmount = parseAmount(amount);

    return (
        <form
            className='Online__form'
            onSubmit={handleReview}
            aria-labelledby='online-transfer-heading'
        >
            <h3
                id='online-transfer-heading'
                className='Online__sectionTitle'
            >
                <FormattedMessage
                    id='online.transfer.form'
                    defaultMessage='Transfer between my accounts'
                />
            </h3>
            <div className='Online__field'>
                <label
                    className='Online__label'
                    htmlFor='online-transfer-from'
                >
                    <FormattedMessage
                        id='online.transfer.from'
                        defaultMessage='From'
                    />
                </label>
                <select
                    id='online-transfer-from'
                    value={fromAccountId}
                    onChange={handleFromChange}
                    aria-describedby='online-transfer-available'
                >
                    {PAY_FROM_ACCOUNTS.map((account) => (
                        <option
                            key={account.id}
                            value={account.id}
                        >
                            {formatMessage(account.name)}
                        </option>
                    ))}
                </select>
                <span
                    id='online-transfer-available'
                    className='Online__muted'
                >
                    <FormattedMessage
                        id='online.pay.amount.available'
                        defaultMessage='Available {amount}'
                        values={{
                            amount: (
                                <FormattedNumber
                                    value={available}

                                    // eslint-disable-next-line react/style-prop-object
                                    style='currency'
                                    currency={PAY_ANYONE_CURRENCY}
                                />
                            ),
                        }}
                    />
                </span>
            </div>
            <div className='Online__field'>
                <label
                    className='Online__label'
                    htmlFor='online-transfer-to'
                >
                    <FormattedMessage
                        id='online.transfer.to'
                        defaultMessage='To'
                    />
                </label>
                <select
                    id='online-transfer-to'
                    value={toAccountId}
                    onChange={handleToChange}
                >
                    {PAY_FROM_ACCOUNTS.filter((account) => account.id !== fromAccountId).map((account) => (
                        <option
                            key={account.id}
                            value={account.id}
                        >
                            {formatMessage(account.name)}
                        </option>
                    ))}
                </select>
            </div>
            <div className='Online__field'>
                <label
                    className='Online__label'
                    htmlFor='online-transfer-amount'
                >
                    <FormattedMessage
                        id='online.transfer.amount'
                        defaultMessage='Amount'
                    />
                </label>
                <input
                    id='online-transfer-amount'
                    type='text'
                    inputMode='decimal'
                    autoComplete='off'
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder={formatMessage({
                        id: 'online.transfer.amount.placeholder',
                        defaultMessage: '0.00',
                    })}
                    aria-describedby='online-transfer-status'
                />
            </div>
            <div className='Online__field'>
                <label
                    className='Online__label'
                    htmlFor='online-transfer-when'
                >
                    <FormattedMessage
                        id='online.pay.date'
                        defaultMessage='When'
                    />
                </label>
                <input
                    id='online-transfer-when'
                    type='date'
                    min={todayInAuckland()}
                    value={when}
                    onChange={handleWhenChange}
                    aria-describedby='online-transfer-when-help'
                />
                <span
                    id='online-transfer-when-help'
                    className='Online__muted'
                >
                    <FormattedMessage
                        id='online.pay.date.help'
                        defaultMessage='Leave blank to send today'
                    />
                </span>
            </div>
            {reviewing && Number.isFinite(reviewAmount) && (
                <div
                    className='Online__review'
                    data-testid='online-transfer-review'
                >
                    <FormattedMessage
                        id='online.transfer.review.summary'
                        defaultMessage='Review: {amount} from {from} to {to}.'
                        values={{
                            amount: (
                                <FormattedNumber
                                    value={reviewAmount}

                                    // eslint-disable-next-line react/style-prop-object
                                    style='currency'
                                    currency={PAY_ANYONE_CURRENCY}
                                />
                            ),
                            from: formatMessage(fromAccount.name),
                            to: formatMessage(toAccount.name),
                        }}
                    />
                </div>
            )}
            <div className='Online__actions'>
                <Button
                    type='submit'
                    emphasis='tertiary'
                >
                    <FormattedMessage
                        id='online.transfer.review'
                        defaultMessage='Review'
                    />
                </Button>
                <Button
                    type='button'
                    emphasis='primary'
                    disabled={!reviewing}
                    onClick={handleConfirm}
                >
                    <FormattedMessage
                        id='online.transfer.confirm'
                        defaultMessage='Confirm transfer'
                    />
                </Button>
            </div>
            <p
                id='online-transfer-status'
                className='Online__status'
                role='status'
                aria-live='polite'
            >
                {error}
                {success}
            </p>
        </form>
    );
}
