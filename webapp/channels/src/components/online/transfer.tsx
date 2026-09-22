// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import {findAccount, formatNzdFromCents, parseAmountCents, submitOwnTransfer} from './store';
import type {AccountId, CardsPaymentsState, TransferError} from './types';

const ERROR_MESSAGES: Record<TransferError, {id: string; defaultMessage: string}> = {
    same_account: {
        id: 'online.transfer.error.same_account',
        defaultMessage: 'Choose two different accounts.',
    },
    invalid_amount: {
        id: 'online.transfer.error.invalid_amount',
        defaultMessage: 'Enter an amount greater than zero, using up to two decimal places.',
    },
    insufficient: {
        id: 'online.transfer.error.insufficient',
        defaultMessage: 'That amount is more than the available balance.',
    },
    unknown_account: {
        id: 'online.transfer.error.unknown_account',
        defaultMessage: 'Choose an eligible account.',
    },
};

type Props = {
    state: CardsPaymentsState;
    onStateChange: (state: CardsPaymentsState) => void;
};

export default function Transfer({state, onStateChange}: Props) {
    const {formatMessage} = useIntl();
    const [fromAccountId, setFromAccountId] = useState<AccountId>(state.accounts[0]?.id ?? 'everyday');
    const [toAccountId, setToAccountId] = useState<AccountId>(state.accounts[1]?.id ?? 'savings');
    const [amount, setAmount] = useState('');
    const [reviewing, setReviewing] = useState(false);
    const [error, setError] = useState<TransferError | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const resetStatus = useCallback(() => {
        setReviewing(false);
        setError(null);
        setSuccess(null);
    }, []);

    const handleFromChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const next = event.target.value as AccountId;
        setFromAccountId(next);
        resetStatus();
        if (next === toAccountId) {
            const other = state.accounts.find((account) => account.id !== next);
            if (other) {
                setToAccountId(other.id);
            }
        }
    }, [resetStatus, state.accounts, toAccountId]);

    const handleToChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        setToAccountId(event.target.value as AccountId);
        resetStatus();
    }, [resetStatus]);

    const handleReview = useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (fromAccountId === toAccountId) {
            setError('same_account');
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
    }, [amount, fromAccountId, toAccountId]);

    const handleConfirm = useCallback(() => {
        const applied = submitOwnTransfer(fromAccountId, toAccountId, amount);
        if (!applied.ok) {
            setSuccess(null);
            setReviewing(false);
            setError(applied.error);
            return;
        }

        const fromAccount = findAccount(applied.state.accounts, fromAccountId);
        const toAccount = findAccount(applied.state.accounts, toAccountId);
        onStateChange(applied.state);
        setAmount('');
        setReviewing(false);
        setError(null);
        setSuccess(formatMessage(
            {
                id: 'online.transfer.success',
                defaultMessage: 'Transferred {amount} from {from} to {to}.',
            },
            {
                amount: formatNzdFromCents(parseAmountCents(amount) ?? 0),
                from: fromAccount?.name ?? fromAccountId,
                to: toAccount?.name ?? toAccountId,
            },
        ));
    }, [amount, formatMessage, fromAccountId, onStateChange, toAccountId]);

    const fromAccount = findAccount(state.accounts, fromAccountId);
    const toAccount = findAccount(state.accounts, toAccountId);
    const reviewAmount = parseAmountCents(amount);

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
                    {state.accounts.map((account) => (
                        <option
                            key={account.id}
                            value={account.id}
                        >
                            {account.name}
                        </option>
                    ))}
                </select>
                <span
                    id='online-transfer-available'
                    className='Online__help'
                >
                    <FormattedMessage
                        id='online.pay.available'
                        defaultMessage='Available {amount}'
                        values={{amount: formatNzdFromCents(fromAccount?.availableCents ?? 0)}}
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
                    {state.accounts.filter((account) => account.id !== fromAccountId).map((account) => (
                        <option
                            key={account.id}
                            value={account.id}
                        >
                            {account.name}
                        </option>
                    ))}
                </select>
            </div>
            <label
                className='Online__field'
                htmlFor='online-transfer-amount'
            >
                <span className='Online__label'>
                    <FormattedMessage
                        id='online.transfer.amount'
                        defaultMessage='Amount'
                    />
                </span>
                <input
                    id='online-transfer-amount'
                    type='text'
                    inputMode='decimal'
                    autoComplete='off'
                    value={amount}
                    onChange={(event) => {
                        setAmount(event.target.value);
                        resetStatus();
                    }}
                    placeholder={formatMessage({
                        id: 'online.transfer.amount.placeholder',
                        defaultMessage: '0.00',
                    })}
                    aria-invalid={error === 'invalid_amount' || error === 'insufficient'}
                    aria-describedby='online-transfer-status'
                />
            </label>
            {reviewing && reviewAmount !== null && (
                <div
                    className='Online__review'
                    data-testid='online-transfer-review'
                >
                    <FormattedMessage
                        id='online.transfer.review.summary'
                        defaultMessage='Review: {amount} from {from} to {to}.'
                        values={{
                            amount: formatNzdFromCents(reviewAmount),
                            from: fromAccount?.name ?? fromAccountId,
                            to: toAccount?.name ?? toAccountId,
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
