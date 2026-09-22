// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, FormattedNumber, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import {
    addPayee,
    findAccount,
    findPayee,
    formatNzdFromCents,
    parseAmountCents,
    PAY_ANYONE_CURRENCY,
    paymentStatus,
    removePayee,
    submitPayAnyone,
    todayInAuckland,
} from './store';
import type {AccountId, CardsPaymentsState, Payee, PayError, Payment} from './types';

const NEW_PAYEE = '__new__';

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
        defaultMessage: 'Enter a New Zealand account number as NN-NNNN-NNNNNNN-NN.',
    },
};

type Props = {
    state: CardsPaymentsState;
    onStateChange: (state: CardsPaymentsState) => void;
};

type Draft = {
    payeeName: string;
    payeeAccount: string;
    fromAccountId: AccountId;
    amountCents: number;
    reference: string;
    when: string;
};

export default function Pay({state, onStateChange}: Props) {
    const {formatMessage} = useIntl();
    const confirmRef = useRef<HTMLElement>(null);
    const payButtonRef = useRef<HTMLButtonElement>(null);

    const [fromAccountId, setFromAccountId] = useState<AccountId>(state.accounts[0]?.id ?? 'everyday');
    const [payeeId, setPayeeId] = useState(state.payees[0]?.id ?? NEW_PAYEE);
    const [newName, setNewName] = useState('');
    const [newAccount, setNewAccount] = useState('');
    const [newReference, setNewReference] = useState('');
    const [payeeFieldError, setPayeeFieldError] = useState<'name' | 'accountNumber' | null>(null);
    const [amount, setAmount] = useState('');
    const [reference, setReference] = useState(state.payees[0]?.referenceDefault ?? '');
    const [when, setWhen] = useState('');
    const [pending, setPending] = useState<Draft | null>(null);
    const [result, setResult] = useState<Payment | null>(null);
    const [error, setError] = useState<PayError | null>(null);

    const selectedPayee = findPayee(state.payees, payeeId);
    const fromAccount = findAccount(state.accounts, fromAccountId) ?? state.accounts[0];

    useEffect(() => {
        if (pending) {
            confirmRef.current?.focus();
        }
    }, [pending]);

    const resetStatus = useCallback(() => {
        setPending(null);
        setError(null);
        setResult(null);
        setPayeeFieldError(null);
    }, []);

    const applyPayee = useCallback((payee: Payee | undefined) => {
        setReference(payee?.referenceDefault ?? '');
    }, []);

    const handleFromChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        setFromAccountId(event.target.value as AccountId);
        resetStatus();
    }, [resetStatus]);

    const handlePayeeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const nextId = event.target.value;
        setPayeeId(nextId);
        applyPayee(findPayee(state.payees, nextId));
        resetStatus();
    }, [applyPayee, resetStatus, state.payees]);

    const handleReview = useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const payeeName = selectedPayee?.name ?? newName;
        const payeeAccount = selectedPayee?.accountNumber ?? newAccount;
        const amountCents = parseAmountCents(amount);

        if (!payeeName.trim()) {
            setError('invalid_payee');
            setPending(null);
            return;
        }
        if (!selectedPayee && !payeeAccount.trim()) {
            setError('invalid_account_number');
            setPending(null);
            return;
        }
        if (amountCents === null) {
            setError('invalid_amount');
            setPending(null);
            return;
        }
        if (paymentStatus(when) === 'sent' && fromAccount && amountCents > fromAccount.availableCents) {
            setError('insufficient');
            setPending(null);
            return;
        }

        setError(null);
        setPending({
            payeeName,
            payeeAccount,
            fromAccountId,
            amountCents,
            reference,
            when,
        });
    }, [amount, fromAccount, fromAccountId, newAccount, newName, reference, selectedPayee, when]);

    const handleCancel = useCallback(() => {
        setPending(null);
        payButtonRef.current?.focus();
    }, []);

    const handleConfirm = useCallback(() => {
        if (!pending) {
            return;
        }

        const applied = submitPayAnyone(
            pending.fromAccountId,
            pending.payeeName,
            pending.payeeAccount,
            (pending.amountCents / 100).toFixed(2),
            pending.reference,
            pending.when,
        );
        if (!applied.ok) {
            setError(applied.error);
            setPending(null);
            return;
        }

        onStateChange(applied.state);
        setResult(applied.payment);
        setPending(null);
        setAmount('');
    }, [onStateChange, pending]);

    const handleAddPayee = useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const added = addPayee(state, newName, newAccount, newReference);
        if (!added.ok) {
            setPayeeFieldError(added.field);
            return;
        }

        onStateChange(added.state);
        setPayeeId(added.payee.id);
        applyPayee(added.payee);
        setNewName('');
        setNewAccount('');
        setNewReference('');
        setPayeeFieldError(null);
        setPending(null);
        setError(null);
    }, [applyPayee, newAccount, newName, newReference, onStateChange, state]);

    const handleRemovePayee = useCallback(() => {
        if (!selectedPayee || selectedPayee.seeded) {
            return;
        }
        const next = removePayee(state, selectedPayee.id);
        onStateChange(next);
        const fallback = next.payees[0];
        setPayeeId(fallback?.id ?? NEW_PAYEE);
        applyPayee(fallback);
        resetStatus();
    }, [applyPayee, onStateChange, resetStatus, selectedPayee, state]);

    const handleAnother = useCallback(() => {
        setResult(null);
        setAmount('');
        setWhen('');
        setError(null);
    }, []);

    if (result) {
        return (
            <section
                className='Online__form'
                data-testid='pay-anyone-success'
                aria-live='polite'
            >
                <h3 className='Online__sectionTitle'>
                    {result.status === 'scheduled' ? (
                        <FormattedMessage
                            id='online.pay.success.scheduled'
                            defaultMessage='Payment of {amount} to {payee} is scheduled for {date}'
                            values={{
                                amount: formatNzdFromCents(result.amountCents),
                                payee: result.payeeName,
                                date: result.when,
                            }}
                        />
                    ) : (
                        <FormattedMessage
                            id='online.pay.success.sent'
                            defaultMessage='Payment of {amount} sent to {payee}'
                            values={{
                                amount: formatNzdFromCents(result.amountCents),
                                payee: result.payeeName,
                            }}
                        />
                    )}
                </h3>
                <Button
                    emphasis='primary'
                    onClick={handleAnother}
                >
                    <FormattedMessage
                        id='online.pay.success.another'
                        defaultMessage='Make another payment'
                    />
                </Button>
            </section>
        );
    }

    return (
        <div className='Online__pay'>
            <form
                className='Online__form'
                onSubmit={handleAddPayee}
                aria-labelledby='online-payee-heading'
            >
                <h3
                    id='online-payee-heading'
                    className='Online__sectionTitle'
                >
                    <FormattedMessage
                        id='online.pay.payees.heading'
                        defaultMessage='Payees'
                    />
                </h3>
                <div className='Online__field'>
                    <label
                        className='Online__label'
                        htmlFor='online-pay-payee'
                    >
                        <FormattedMessage
                            id='online.pay.payee'
                            defaultMessage='Payee'
                        />
                    </label>
                    <select
                        id='online-pay-payee'
                        value={payeeId}
                        onChange={handlePayeeChange}
                        disabled={Boolean(pending)}
                    >
                        {state.payees.map((payee) => (
                            <option
                                key={payee.id}
                                value={payee.id}
                            >
                                {payee.name}
                            </option>
                        ))}
                        <option value={NEW_PAYEE}>
                            {formatMessage({
                                id: 'online.pay.payee.new',
                                defaultMessage: 'Add a new payee',
                            })}
                        </option>
                    </select>
                </div>
                {selectedPayee && !selectedPayee.seeded && (
                    <Button
                        type='button'
                        emphasis='tertiary'
                        size='sm'
                        onClick={handleRemovePayee}
                        disabled={Boolean(pending)}
                    >
                        <FormattedMessage
                            id='online.pay.payee.remove'
                            defaultMessage='Remove payee'
                        />
                    </Button>
                )}
                {payeeId === NEW_PAYEE && (
                    <>
                        <label
                            className='Online__field'
                            htmlFor='online-pay-new-name'
                        >
                            <span className='Online__label'>
                                <FormattedMessage
                                    id='online.pay.payee.name'
                                    defaultMessage='Payee name'
                                />
                            </span>
                            <input
                                id='online-pay-new-name'
                                type='text'
                                autoComplete='off'
                                value={newName}
                                onChange={(event) => {
                                    setNewName(event.target.value);
                                    setPayeeFieldError(null);
                                }}
                                disabled={Boolean(pending)}
                                aria-invalid={payeeFieldError === 'name'}
                            />
                        </label>
                        <label
                            className='Online__field'
                            htmlFor='online-pay-new-account'
                        >
                            <span className='Online__label'>
                                <FormattedMessage
                                    id='online.pay.account_number'
                                    defaultMessage='Account number'
                                />
                            </span>
                            <input
                                id='online-pay-new-account'
                                type='text'
                                autoComplete='off'
                                value={newAccount}
                                onChange={(event) => {
                                    setNewAccount(event.target.value);
                                    setPayeeFieldError(null);
                                }}
                                disabled={Boolean(pending)}
                                aria-invalid={payeeFieldError === 'accountNumber'}
                            />
                        </label>
                        <label
                            className='Online__field'
                            htmlFor='online-pay-new-reference'
                        >
                            <span className='Online__label'>
                                <FormattedMessage
                                    id='online.pay.payee.reference_default'
                                    defaultMessage='Default reference'
                                />
                            </span>
                            <input
                                id='online-pay-new-reference'
                                type='text'
                                autoComplete='off'
                                value={newReference}
                                onChange={(event) => setNewReference(event.target.value)}
                                disabled={Boolean(pending)}
                            />
                        </label>
                        {payeeFieldError && (
                            <p
                                className='Online__status'
                                role='alert'
                            >
                                <FormattedMessage
                                    id={payeeFieldError === 'name' ? 'online.pay.error.payee' : 'online.pay.error.account_number'}
                                    defaultMessage={payeeFieldError === 'name' ? 'Enter the payee name.' : 'Enter a New Zealand account number as NN-NNNN-NNNNNNN-NN.'}
                                />
                            </p>
                        )}
                        <Button
                            type='submit'
                            emphasis='tertiary'
                            disabled={Boolean(pending)}
                        >
                            <FormattedMessage
                                id='online.pay.payee.save'
                                defaultMessage='Save payee'
                            />
                        </Button>
                    </>
                )}
            </form>
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
                <div className='Online__field'>
                    <label
                        className='Online__label'
                        htmlFor='online-pay-from'
                    >
                        <FormattedMessage
                            id='online.pay.from'
                            defaultMessage='From'
                        />
                    </label>
                    <select
                        id='online-pay-from'
                        value={fromAccountId}
                        onChange={handleFromChange}
                        disabled={Boolean(pending)}
                        aria-describedby='online-pay-available'
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
                        id='online-pay-available'
                        className='Online__help'
                    >
                        <FormattedMessage
                            id='online.pay.available'
                            defaultMessage='Available {amount}'
                            values={{amount: formatNzdFromCents(fromAccount?.availableCents ?? 0)}}
                        />
                    </span>
                </div>
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
                        onChange={(event) => {
                            setAmount(event.target.value);
                            resetStatus();
                        }}
                        disabled={Boolean(pending)}
                        placeholder={formatMessage({
                            id: 'online.pay.amount.placeholder',
                            defaultMessage: '0.00',
                        })}
                        aria-invalid={error === 'invalid_amount' || error === 'insufficient'}
                    />
                </label>
                <label
                    className='Online__field'
                    htmlFor='online-pay-reference'
                >
                    <span className='Online__label'>
                        <FormattedMessage
                            id='online.pay.reference'
                            defaultMessage='Reference'
                        />
                    </span>
                    <input
                        id='online-pay-reference'
                        type='text'
                        autoComplete='off'
                        value={reference}
                        onChange={(event) => {
                            setReference(event.target.value);
                            resetStatus();
                        }}
                        disabled={Boolean(pending)}
                    />
                </label>
                <div className='Online__field'>
                    <label
                        className='Online__label'
                        htmlFor='online-pay-when'
                    >
                        <FormattedMessage
                            id='online.pay.date'
                            defaultMessage='When'
                        />
                    </label>
                    <input
                        id='online-pay-when'
                        type='date'
                        min={todayInAuckland()}
                        value={when}
                        onChange={(event) => {
                            setWhen(event.target.value);
                            resetStatus();
                        }}
                        disabled={Boolean(pending)}
                        aria-describedby='online-pay-when-help'
                    />
                    <span
                        id='online-pay-when-help'
                        className='Online__help'
                    >
                        <FormattedMessage
                            id='online.pay.date.help'
                            defaultMessage='Leave blank to send today'
                        />
                    </span>
                </div>
                {error && (
                    <p
                        className='Online__status'
                        role='alert'
                    >
                        <FormattedMessage
                            id={ERROR_MESSAGES[error].id}
                            defaultMessage={ERROR_MESSAGES[error].defaultMessage}
                        />
                    </p>
                )}
                <Button
                    ref={payButtonRef}
                    type='submit'
                    emphasis='primary'
                    disabled={Boolean(pending)}
                >
                    <FormattedMessage
                        id='online.pay.review'
                        defaultMessage='Review'
                    />
                </Button>
            </form>
            {pending && (
                <section
                    ref={confirmRef}
                    className='Online__form Online__review'
                    data-testid='pay-anyone-confirm'
                    tabIndex={-1}
                    aria-labelledby='online-pay-confirm-heading'
                >
                    <h3
                        id='online-pay-confirm-heading'
                        className='Online__sectionTitle'
                    >
                        <FormattedMessage
                            id='online.pay.confirm.heading'
                            defaultMessage='Confirm this payment'
                        />
                    </h3>
                    <dl className='Online__summary'>
                        <div>
                            <dt>
                                <FormattedMessage
                                    id='online.pay.confirm.payee'
                                    defaultMessage='Payee'
                                />
                            </dt>
                            <dd>{pending.payeeName}</dd>
                        </div>
                        <div>
                            <dt>
                                <FormattedMessage
                                    id='online.pay.confirm.from'
                                    defaultMessage='From'
                                />
                            </dt>
                            <dd>{fromAccount?.name ?? fromAccountId}</dd>
                        </div>
                        <div>
                            <dt>
                                <FormattedMessage
                                    id='online.pay.confirm.amount'
                                    defaultMessage='Amount'
                                />
                            </dt>
                            <dd>
                                <FormattedNumber
                                    value={pending.amountCents / 100}

                                    // eslint-disable-next-line react/style-prop-object
                                    style='currency'
                                    currency={PAY_ANYONE_CURRENCY}
                                />
                            </dd>
                        </div>
                        <div>
                            <dt>
                                <FormattedMessage
                                    id='online.pay.confirm.reference'
                                    defaultMessage='Reference'
                                />
                            </dt>
                            <dd>
                                {pending.reference || (
                                    <FormattedMessage
                                        id='online.pay.confirm.reference.empty'
                                        defaultMessage='None'
                                    />
                                )}
                            </dd>
                        </div>
                    </dl>
                    <aside
                        className='Online__warning'
                        data-testid='pay-anyone-warning'
                    >
                        <strong>
                            <FormattedMessage
                                id='online.pay.warning.heading'
                                defaultMessage='Scam warning'
                            />
                        </strong>
                        <p>
                            <FormattedMessage
                                id='online.pay.warning'
                                defaultMessage='ANZ will never ask you to transfer money to keep an account safe. Treat investment opportunities and anyone who pressures you to pay a new or unusual payee as a scam.'
                            />
                        </p>
                    </aside>
                    <div className='Online__actions'>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            onClick={handleCancel}
                        >
                            <FormattedMessage
                                id='online.pay.cancel'
                                defaultMessage='Cancel'
                            />
                        </Button>
                        <Button
                            type='button'
                            emphasis='primary'
                            aria-label={formatMessage({
                                id: 'online.pay.confirm',
                                defaultMessage: 'Confirm payment',
                            })}
                            onClick={handleConfirm}
                        >
                            <FormattedMessage
                                id='online.pay.confirm'
                                defaultMessage='Confirm payment'
                            />
                        </Button>
                    </div>
                </section>
            )}
        </div>
    );
}
