// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import Header from 'components/widgets/header';

import {
    formatNzdFromCents,
    isOwnAccountId,
    loadOwnAccountTransferState,
    submitOwnAccountTransfer,
} from './accounts';
import {OWN_ACCOUNT_IDS} from './types';
import type {OwnAccountId, OwnAccountTransferState, TransferError} from './types';

import './own_account_transfer.scss';

const ERROR_MESSAGES: Record<TransferError, {id: string; defaultMessage: string}> = {
    same_account: {
        id: 'own_account_transfer.error.same_account',
        defaultMessage: 'Choose two different accounts.',
    },
    invalid_amount: {
        id: 'own_account_transfer.error.invalid_amount',
        defaultMessage: 'Enter an amount greater than zero, using up to two decimal places.',
    },
    insufficient: {
        id: 'own_account_transfer.error.insufficient',
        defaultMessage: 'That amount is more than the available balance.',
    },
    unknown_account: {
        id: 'own_account_transfer.error.unknown_account',
        defaultMessage: 'Choose an eligible account.',
    },
};

export default function OwnAccountTransfer() {
    const {formatMessage} = useIntl();
    const [state, setState] = useState<OwnAccountTransferState>(() => loadOwnAccountTransferState());
    const [fromAccountId, setFromAccountId] = useState<OwnAccountId>('youmoney');
    const [toAccountId, setToAccountId] = useState<OwnAccountId>('rapid-save');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState<TransferError | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const accountById = useMemo(() => {
        return new Map(state.accounts.map((account) => [account.id, account]));
    }, [state.accounts]);

    const selectFromAccount = useCallback((id: OwnAccountId) => {
        setFromAccountId(id);
        setError(null);
        setSuccess(null);
        if (id === toAccountId) {
            const next = OWN_ACCOUNT_IDS.find((other) => other !== id);
            if (next) {
                setToAccountId(next);
            }
        }
    }, [toAccountId]);

    const selectToAccount = useCallback((id: OwnAccountId) => {
        setToAccountId(id);
        setError(null);
        setSuccess(null);
    }, []);

    const handleFromChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        if (isOwnAccountId(event.target.value)) {
            selectFromAccount(event.target.value);
        }
    }, [selectFromAccount]);

    const handleToChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        if (isOwnAccountId(event.target.value)) {
            selectToAccount(event.target.value);
        }
    }, [selectToAccount]);

    const handleAmountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(event.target.value);
        setError(null);
        setSuccess(null);
    }, []);

    const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const result = submitOwnAccountTransfer(fromAccountId, toAccountId, amount);
        if (!result.ok) {
            setSuccess(null);
            setError(result.error);
            return;
        }

        const fromAccount = result.state.accounts.find((account) => account.id === fromAccountId);
        const toAccount = result.state.accounts.find((account) => account.id === toAccountId);
        setState(result.state);
        setAmount('');
        setError(null);
        setSuccess(formatMessage(
            {
                id: 'own_account_transfer.success',
                defaultMessage: 'Transferred {amount} from {from} to {to}.',
            },
            {
                amount: formatNzdFromCents(result.transfer.amountCents),
                from: fromAccount?.name ?? fromAccountId,
                to: toAccount?.name ?? toAccountId,
            },
        ));
    }, [amount, formatMessage, fromAccountId, toAccountId]);

    return (
        <div
            id='app-content'
            className='OwnAccountTransfer app__content'
        >
            <Header
                level={2}
                className='OwnAccountTransfer__header'
                heading={
                    <FormattedMessage
                        id='own_account_transfer.heading'
                        defaultMessage='Transfer'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='own_account_transfer.subtitle'
                        defaultMessage='Move money between your own accounts'
                    />
                }
            />
            <div className='OwnAccountTransfer__main'>
                <section
                    className='OwnAccountTransfer__balances'
                    aria-labelledby='own-account-balances-heading'
                >
                    <h3
                        id='own-account-balances-heading'
                        className='OwnAccountTransfer__sectionTitle'
                    >
                        <FormattedMessage
                            id='own_account_transfer.balances'
                            defaultMessage='Your accounts'
                        />
                    </h3>
                    <ul className='OwnAccountTransfer__accountList'>
                        {state.accounts.map((account) => (
                            <li
                                key={account.id}
                                className='OwnAccountTransfer__account'
                            >
                                <div>
                                    <p className='OwnAccountTransfer__accountName'>
                                        <FormattedMessage
                                            id={account.nameId}
                                            defaultMessage={account.name}
                                        />
                                    </p>
                                    <p className='OwnAccountTransfer__accountType'>
                                        <FormattedMessage
                                            id={account.typeId}
                                            defaultMessage={account.type}
                                        />
                                    </p>
                                </div>
                                <p className='OwnAccountTransfer__accountBalance'>
                                    {formatNzdFromCents(account.balanceCents)}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
                <form
                    className='OwnAccountTransfer__form'
                    onSubmit={handleSubmit}
                    aria-labelledby='own-account-transfer-form-heading'
                >
                    <h3
                        id='own-account-transfer-form-heading'
                        className='OwnAccountTransfer__sectionTitle'
                    >
                        <FormattedMessage
                            id='own_account_transfer.form'
                            defaultMessage='Transfer between my accounts'
                        />
                    </h3>
                    <label
                        className='OwnAccountTransfer__field'
                        htmlFor='own-account-transfer-from'
                    >
                        <span className='OwnAccountTransfer__label'>
                            <FormattedMessage
                                id='own_account_transfer.from'
                                defaultMessage='From'
                            />
                        </span>
                        <select
                            id='own-account-transfer-from'
                            value={fromAccountId}
                            onChange={handleFromChange}
                        >
                            {state.accounts.map((account) => (
                                <option
                                    key={account.id}
                                    value={account.id}
                                >
                                    {formatMessage({id: account.nameId, defaultMessage: account.name})}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label
                        className='OwnAccountTransfer__field'
                        htmlFor='own-account-transfer-to'
                    >
                        <span className='OwnAccountTransfer__label'>
                            <FormattedMessage
                                id='own_account_transfer.to'
                                defaultMessage='To'
                            />
                        </span>
                        <select
                            id='own-account-transfer-to'
                            value={toAccountId}
                            onChange={handleToChange}
                        >
                            {state.accounts.filter((account) => account.id !== fromAccountId).map((account) => (
                                <option
                                    key={account.id}
                                    value={account.id}
                                >
                                    {formatMessage({id: account.nameId, defaultMessage: account.name})}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label
                        className='OwnAccountTransfer__field'
                        htmlFor='own-account-transfer-amount'
                    >
                        <span className='OwnAccountTransfer__label'>
                            <FormattedMessage
                                id='own_account_transfer.amount'
                                defaultMessage='Amount'
                            />
                        </span>
                        <input
                            id='own-account-transfer-amount'
                            type='text'
                            inputMode='decimal'
                            autoComplete='off'
                            value={amount}
                            onChange={handleAmountChange}
                            placeholder={formatMessage({
                                id: 'own_account_transfer.amount.placeholder',
                                defaultMessage: '0.00',
                            })}
                            aria-invalid={error === 'invalid_amount' || error === 'insufficient'}
                            aria-describedby={error ? 'own-account-transfer-status' : undefined}
                        />
                    </label>
                    <Button
                        type='submit'
                        emphasis='primary'
                    >
                        <FormattedMessage
                            id='own_account_transfer.submit'
                            defaultMessage='Transfer'
                        />
                    </Button>
                    <p
                        id='own-account-transfer-status'
                        className='OwnAccountTransfer__status'
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
                <section
                    className='OwnAccountTransfer__recent'
                    aria-labelledby='own-account-transfers-heading'
                >
                    <h3
                        id='own-account-transfers-heading'
                        className='OwnAccountTransfer__sectionTitle'
                    >
                        <FormattedMessage
                            id='own_account_transfer.recent.title'
                            defaultMessage='Recent transfers'
                        />
                    </h3>
                    {state.transfers.length === 0 ? (
                        <p className='OwnAccountTransfer__empty'>
                            <FormattedMessage
                                id='own_account_transfer.recent.empty'
                                defaultMessage='No transfers yet.'
                            />
                        </p>
                    ) : (
                        <ul className='OwnAccountTransfer__transferList'>
                            {state.transfers.map((transfer) => {
                                const fromAccount = accountById.get(transfer.fromAccountId);
                                const toAccount = accountById.get(transfer.toAccountId);
                                return (
                                    <li
                                        key={transfer.id}
                                        className='OwnAccountTransfer__transfer'
                                    >
                                        <FormattedMessage
                                            id='own_account_transfer.recent.row'
                                            defaultMessage='{amount} from {from} to {to}'
                                            values={{
                                                amount: formatNzdFromCents(transfer.amountCents),
                                                from: fromAccount?.name ?? transfer.fromAccountId,
                                                to: toAccount?.name ?? transfer.toAccountId,
                                            }}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
