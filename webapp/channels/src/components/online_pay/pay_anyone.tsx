// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, FormattedNumber, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {
    applyPayAnyonePayment,
    getAccountBalance,
    PAY_ANYONE_CURRENCY,
    PAY_FROM_ACCOUNTS,
    paymentStatus,
    todayInAuckland,
    type PayAnyoneDraft,
    type PayAnyonePayment,
} from './payments';

import './pay_anyone.scss';

type FormState = {
    fromAccountId: string;
    payeeName: string;
    payeeAccount: string;
    amount: string;
    reference: string;
    when: string;
};

const EMPTY_FORM: FormState = {
    fromAccountId: PAY_FROM_ACCOUNTS[0].id,
    payeeName: '',
    payeeAccount: '',
    amount: '',
    reference: '',
    when: '',
};

function parseAmount(value: string): number {
    return Number.parseFloat(value);
}

export default function PayAnyone() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const confirmRef = useRef<HTMLElement>(null);
    const payButtonRef = useRef<HTMLButtonElement>(null);

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [balances, setBalances] = useState<Record<string, number>>(() => (
        Object.fromEntries(PAY_FROM_ACCOUNTS.map((account) => [account.id, getAccountBalance(account.id)]))
    ));
    const [pending, setPending] = useState<PayAnyoneDraft | null>(null);
    const [result, setResult] = useState<PayAnyonePayment | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    useEffect(() => {
        if (pending) {
            confirmRef.current?.focus();
        }
    }, [pending]);

    const fromAccount = useMemo(
        () => PAY_FROM_ACCOUNTS.find((account) => account.id === form.fromAccountId) ?? PAY_FROM_ACCOUNTS[0],
        [form.fromAccountId],
    );
    const available = balances[fromAccount.id] ?? fromAccount.available;

    const handleFieldChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const {name, value} = event.target;
        setForm((current) => ({...current, [name]: value}));
        setError(null);
    }, []);

    const handleReview = useCallback((event: React.FormEvent) => {
        event.preventDefault();

        const payeeName = form.payeeName.trim();
        if (!payeeName) {
            setError(formatMessage({
                id: 'online.pay.error.payee',
                defaultMessage: 'Enter the payee name',
            }));
            return;
        }

        const amount = parseAmount(form.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setError(formatMessage({
                id: 'online.pay.error.amount',
                defaultMessage: 'Enter an amount greater than zero',
            }));
            return;
        }

        const status = paymentStatus(form.when);
        if (status === 'sent' && amount > available) {
            setError(formatMessage({
                id: 'online.pay.error.funds',
                defaultMessage: 'There is not enough money in this account',
            }));
            return;
        }

        setError(null);
        setPending({
            payeeName,
            payeeAccount: form.payeeAccount.trim(),
            fromAccountId: form.fromAccountId,
            amount,
            reference: form.reference.trim(),
            when: form.when,
        });
    }, [available, form, formatMessage]);

    const handleCancel = useCallback(() => {
        setPending(null);
        payButtonRef.current?.focus();
    }, []);

    const handleConfirm = useCallback(() => {
        if (!pending) {
            return;
        }

        const applied = applyPayAnyonePayment(pending);
        if (!applied.ok) {
            setError(formatMessage({
                id: 'online.pay.error.funds',
                defaultMessage: 'There is not enough money in this account',
            }));
            setPending(null);
            return;
        }

        setBalances(applied.state.balances);
        setResult(applied.payment);
        setPending(null);
    }, [formatMessage, pending]);

    const handleAnother = useCallback(() => {
        setResult(null);
        setForm((current) => ({
            ...EMPTY_FORM,
            fromAccountId: current.fromAccountId,
        }));
        setError(null);
    }, []);

    return (
        <div
            id='app-content'
            className='PayAnyone app__content'
        >
            <Header
                level={2}
                className='PayAnyone__header'
                heading={
                    <FormattedMessage
                        id='online.pay.heading'
                        defaultMessage='Pay anyone'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='online.pay.subtitle'
                        defaultMessage='Check the payee before money leaves your account'
                    />
                }
            />
            <div className='PayAnyone__body'>
                {result ? (
                    <section
                        className='PayAnyone__success'
                        data-testid='pay-anyone-success'
                        aria-live='polite'
                    >
                        <h3 className='PayAnyone__sectionTitle'>
                            {result.status === 'scheduled' ? (
                                <FormattedMessage
                                    id='online.pay.success.scheduled'
                                    defaultMessage='Payment of {amount} to {payee} is scheduled for {date}'
                                    values={{
                                        amount: (
                                            <FormattedNumber
                                                value={result.amount}

                                                // eslint-disable-next-line react/style-prop-object
                                                style='currency'
                                                currency={PAY_ANYONE_CURRENCY}
                                            />
                                        ),
                                        payee: result.payeeName,
                                        date: result.when,
                                    }}
                                />
                            ) : (
                                <FormattedMessage
                                    id='online.pay.success.sent'
                                    defaultMessage='Payment of {amount} sent to {payee}'
                                    values={{
                                        amount: (
                                            <FormattedNumber
                                                value={result.amount}

                                                // eslint-disable-next-line react/style-prop-object
                                                style='currency'
                                                currency={PAY_ANYONE_CURRENCY}
                                            />
                                        ),
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
                ) : (
                    <>
                        <form
                            className='PayAnyone__form'
                            onSubmit={handleReview}
                        >
                            <div className='PayAnyone__field'>
                                <label
                                    className='PayAnyone__label'
                                    htmlFor='pay-anyone-from'
                                >
                                    <FormattedMessage
                                        id='online.pay.from'
                                        defaultMessage='From account'
                                    />
                                </label>
                                <select
                                    id='pay-anyone-from'
                                    className='PayAnyone__control'
                                    name='fromAccountId'
                                    value={form.fromAccountId}
                                    onChange={handleFieldChange}
                                    disabled={Boolean(pending)}
                                    aria-describedby='pay-anyone-available'
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
                                    id='pay-anyone-available'
                                    className='PayAnyone__help'
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
                            <label className='PayAnyone__field'>
                                <span className='PayAnyone__label'>
                                    <FormattedMessage
                                        id='online.pay.payee'
                                        defaultMessage='Payee name'
                                    />
                                </span>
                                <input
                                    className='PayAnyone__control'
                                    name='payeeName'
                                    value={form.payeeName}
                                    onChange={handleFieldChange}
                                    disabled={Boolean(pending)}
                                    autoComplete='name'
                                />
                            </label>
                            <label className='PayAnyone__field'>
                                <span className='PayAnyone__label'>
                                    <FormattedMessage
                                        id='online.pay.payeeAccount'
                                        defaultMessage='Account number'
                                    />
                                </span>
                                <input
                                    className='PayAnyone__control'
                                    name='payeeAccount'
                                    value={form.payeeAccount}
                                    onChange={handleFieldChange}
                                    disabled={Boolean(pending)}
                                    autoComplete='off'
                                />
                            </label>
                            <label className='PayAnyone__field'>
                                <span className='PayAnyone__label'>
                                    <FormattedMessage
                                        id='online.pay.amount'
                                        defaultMessage='Amount'
                                    />
                                </span>
                                <input
                                    className='PayAnyone__control'
                                    name='amount'
                                    type='number'
                                    min='0.01'
                                    step='0.01'
                                    value={form.amount}
                                    onChange={handleFieldChange}
                                    disabled={Boolean(pending)}
                                />
                            </label>
                            <label className='PayAnyone__field'>
                                <span className='PayAnyone__label'>
                                    <FormattedMessage
                                        id='online.pay.reference'
                                        defaultMessage='Reference'
                                    />
                                </span>
                                <input
                                    className='PayAnyone__control'
                                    name='reference'
                                    value={form.reference}
                                    onChange={handleFieldChange}
                                    disabled={Boolean(pending)}
                                />
                            </label>
                            <div className='PayAnyone__field'>
                                <label
                                    className='PayAnyone__label'
                                    htmlFor='pay-anyone-when'
                                >
                                    <FormattedMessage
                                        id='online.pay.date'
                                        defaultMessage='When'
                                    />
                                </label>
                                <input
                                    id='pay-anyone-when'
                                    className='PayAnyone__control'
                                    name='when'
                                    type='date'
                                    min={todayInAuckland()}
                                    value={form.when}
                                    onChange={handleFieldChange}
                                    disabled={Boolean(pending)}
                                    aria-describedby='pay-anyone-when-help'
                                />
                                <span
                                    id='pay-anyone-when-help'
                                    className='PayAnyone__help'
                                >
                                    <FormattedMessage
                                        id='online.pay.date.help'
                                        defaultMessage='Leave blank to send today'
                                    />
                                </span>
                            </div>
                            {error && (
                                <p
                                    className='PayAnyone__error'
                                    role='alert'
                                >
                                    {error}
                                </p>
                            )}
                            <Button
                                ref={payButtonRef}
                                type='submit'
                                emphasis='primary'
                                disabled={Boolean(pending)}
                            >
                                <FormattedMessage
                                    id='online.pay.submit'
                                    defaultMessage='Pay'
                                />
                            </Button>
                        </form>
                        {pending && (
                            <section
                                ref={confirmRef}
                                className='PayAnyone__confirm'
                                data-testid='pay-anyone-confirm'
                                tabIndex={-1}
                                aria-labelledby='pay-anyone-confirm-heading'
                            >
                                <h3
                                    id='pay-anyone-confirm-heading'
                                    className='PayAnyone__sectionTitle'
                                >
                                    <FormattedMessage
                                        id='online.pay.confirm.heading'
                                        defaultMessage='Confirm this payment'
                                    />
                                </h3>
                                <dl className='PayAnyone__summary'>
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
                                        <dd>{formatMessage(fromAccount.name)}</dd>
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
                                                value={pending.amount}

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
                                    className='PayAnyone__warning'
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
                                            defaultMessage='BNZ will never ask you to transfer money to keep an account safe. Treat investment opportunities and anyone who pressures you to pay a new or unusual payee as a scam.'
                                        />
                                    </p>
                                </aside>
                                <div className='PayAnyone__confirmActions'>
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
                    </>
                )}
            </div>
        </div>
    );
}
