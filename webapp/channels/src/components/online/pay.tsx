// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import {
    findAccount,
    formatAudFromCents,
    isValidPayeeAccountNumber,
    parseAmountCents,
    submitPayAnyone,
    transferableAccounts,
} from './store';
import type {AccountId, EverydayMoneyState, PayError} from './types';

const ERROR_MESSAGES: Record<PayError, {id: string; defaultMessage: string}> = {
    invalid_amount: {
        id: 'online.pay.error.invalid_amount',
        defaultMessage: 'Enter an amount greater than zero, using up to two decimal places.',
    },
    insufficient: {
        id: 'online.pay.error.insufficient',
        defaultMessage: 'That amount is more than the available balance.',
    },
    unknown_account: {
        id: 'online.pay.error.unknown_account',
        defaultMessage: 'Choose an eligible account.',
    },
    invalid_payee: {
        id: 'online.pay.error.payee',
        defaultMessage: 'Enter the payee name.',
    },
    invalid_account_number: {
        id: 'online.pay.error.account_number',
        defaultMessage: 'Enter a 6 to 10 digit account number.',
    },
};

type Props = {
    state: EverydayMoneyState;
    onStateChange: (state: EverydayMoneyState) => void;
};

export default function Pay({state, onStateChange}: Props) {
    const {formatMessage} = useIntl();
    const eligible = transferableAccounts(state.accounts);
    const [fromAccountId, setFromAccountId] = useState<AccountId>(eligible[0]?.id ?? 'everyday');
    const [payeeName, setPayeeName] = useState(state.payees[0]?.name ?? '');
    const [accountNumber, setAccountNumber] = useState(state.payees[0]?.accountNumber ?? '');
    const [amount, setAmount] = useState('');
    const [reviewing, setReviewing] = useState(false);
    const [error, setError] = useState<PayError | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const resetStatus = useCallback(() => {
        setReviewing(false);
        setError(null);
        setSuccess(null);
    }, []);

    const handleFromChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        setFromAccountId(event.target.value as AccountId);
        resetStatus();
    }, [resetStatus]);

    const handlePayeeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setPayeeName(event.target.value);
        resetStatus();
    }, [resetStatus]);

    const handleAccountNumberChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setAccountNumber(event.target.value);
        resetStatus();
    }, [resetStatus]);

    const handleAmountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(event.target.value);
        resetStatus();
    }, [resetStatus]);

    const handleReview = useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!payeeName.trim()) {
            setError('invalid_payee');
            setReviewing(false);
            return;
        }
        if (!isValidPayeeAccountNumber(accountNumber)) {
            setError('invalid_account_number');
            setReviewing(false);
            return;
        }
        if (parseAmountCents(amount) === null) {
            setError('invalid_amount');
            setReviewing(false);
            return;
        }
        setError(null);
        setSuccess(null);
        setReviewing(true);
    }, [accountNumber, amount, payeeName]);

    const handleConfirm = useCallback(() => {
        const result = submitPayAnyone(fromAccountId, payeeName, accountNumber, amount);
        if (!result.ok) {
            setSuccess(null);
            setReviewing(false);
            setError(result.error);
            return;
        }

        const fromAccount = findAccount(result.state.accounts, fromAccountId);
        onStateChange(result.state);
        setAmount('');
        setReviewing(false);
        setError(null);
        setSuccess(formatMessage(
            {
                id: 'online.pay.success',
                defaultMessage: 'Paid {amount} to {payee} from {from}.',
            },
            {
                amount: formatAudFromCents(parseAmountCents(amount) ?? 0),
                payee: payeeName.trim(),
                from: fromAccount?.name ?? fromAccountId,
            },
        ));
    }, [accountNumber, amount, formatMessage, fromAccountId, onStateChange, payeeName]);

    const fromAccount = findAccount(state.accounts, fromAccountId);
    const reviewAmount = parseAmountCents(amount);

    return (
        <form
            className='Online__form'
            onSubmit={handleReview}
            aria-labelledby='online-pay-heading'
        >
            <h3
                id='online-pay-heading'
                className='Online__sectionTitle'
            >
                <FormattedMessage
                    id='online.pay.form'
                    defaultMessage='Pay anyone'
                />
            </h3>
            <label
                className='Online__field'
                htmlFor='online-pay-from'
            >
                <span className='Online__label'>
                    <FormattedMessage
                        id='online.pay.from'
                        defaultMessage='From'
                    />
                </span>
                <select
                    id='online-pay-from'
                    value={fromAccountId}
                    onChange={handleFromChange}
                >
                    {eligible.map((account) => (
                        <option
                            key={account.id}
                            value={account.id}
                        >
                            {account.name}
                        </option>
                    ))}
                </select>
            </label>
            <label
                className='Online__field'
                htmlFor='online-pay-name'
            >
                <span className='Online__label'>
                    <FormattedMessage
                        id='online.pay.payee'
                        defaultMessage='Payee'
                    />
                </span>
                <input
                    id='online-pay-name'
                    type='text'
                    autoComplete='off'
                    value={payeeName}
                    onChange={handlePayeeChange}
                />
            </label>
            <label
                className='Online__field'
                htmlFor='online-pay-account-number'
            >
                <span className='Online__label'>
                    <FormattedMessage
                        id='online.pay.account_number'
                        defaultMessage='Account number'
                    />
                </span>
                <input
                    id='online-pay-account-number'
                    type='text'
                    inputMode='numeric'
                    autoComplete='off'
                    value={accountNumber}
                    onChange={handleAccountNumberChange}
                    aria-invalid={error === 'invalid_account_number'}
                    aria-describedby='online-pay-status'
                />
            </label>
            <label
                className='Online__field'
                htmlFor='online-pay-amount'
            >
                <span className='Online__label'>
                    <FormattedMessage
                        id='online.pay.amount'
                        defaultMessage='Amount'
                    />
                </span>
                <input
                    id='online-pay-amount'
                    type='text'
                    inputMode='decimal'
                    autoComplete='off'
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder={formatMessage({
                        id: 'online.pay.amount.placeholder',
                        defaultMessage: '0.00',
                    })}
                    aria-invalid={error === 'invalid_amount' || error === 'insufficient'}
                    aria-describedby='online-pay-status'
                />
            </label>
            {reviewing && reviewAmount !== null && (
                <div
                    className='Online__review'
                    data-testid='online-pay-review'
                >
                    <FormattedMessage
                        id='online.pay.review.summary'
                        defaultMessage='Review: {amount} from {from} to {payee} ({accountNumber}).'
                        values={{
                            amount: formatAudFromCents(reviewAmount),
                            from: fromAccount?.name ?? fromAccountId,
                            payee: payeeName.trim(),
                            accountNumber: accountNumber.trim(),
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
                        id='online.pay.review'
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
                        id='online.pay.confirm'
                        defaultMessage='Confirm payment'
                    />
                </Button>
            </div>
            <p
                id='online-pay-status'
                className='Online__status'
                role='status'
                aria-live='polite'
            >
                {error && (
                    <FormattedMessage
                        id={ERROR_MESSAGES[error].id}
                        defaultMessage={ERROR_MESSAGES[error].defaultMessage}
                    />
                )}
                {success}
            </p>
        </form>
    );
}
