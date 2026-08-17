// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, FormattedNumber, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {
    applyPayAnyonePayment,
    formatPaymentDateDisplay,
    getPayAnyoneState,
    listScheduledPayments,
    maxPaymentDate,
    PAY_ANYONE_CURRENCY,
    PAY_FROM_ACCOUNTS,
    paymentStatus,
    resetPayAnyoneState,
    todayInAuckland,
    validatePaymentDate,
    type PayAnyonePayment,
    type PayAnyoneState,
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

function emptyForm(now: Date = new Date()): FormState {
    return {
        fromAccountId: PAY_FROM_ACCOUNTS[0].id,
        payeeName: '',
        payeeAccount: '',
        amount: '',
        reference: '',
        when: todayInAuckland(now),
    };
}

function parseAmount(value: string): number {
    return Number.parseFloat(value);
}

function accountName(accountId: string, formatMessage: ReturnType<typeof useIntl>['formatMessage']): string {
    const account = PAY_FROM_ACCOUNTS.find((item) => item.id === accountId);
    return account ? formatMessage(account.name) : accountId;
}

export default function PayAnyone() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [form, setForm] = useState<FormState>(() => emptyForm());
    const [state, setState] = useState<PayAnyoneState>(() => getPayAnyoneState());
    const [result, setResult] = useState<PayAnyonePayment | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [resetNotice, setResetNotice] = useState(false);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const fromAccount = useMemo(
        () => PAY_FROM_ACCOUNTS.find((account) => account.id === form.fromAccountId) ?? PAY_FROM_ACCOUNTS[0],
        [form.fromAccountId],
    );
    const available = state.balances[fromAccount.id] ?? fromAccount.available;
    const scheduled = listScheduledPayments(state.payments);
    const minDate = todayInAuckland();
    const maxDate = maxPaymentDate();
    const isPayNow = paymentStatus(form.when) === 'sent';

    const handleFieldChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const {name, value} = event.target;
        setForm((current) => ({...current, [name]: value}));
        setError(null);
        setResetNotice(false);
    }, []);

    const handleSubmit = useCallback((event: React.FormEvent) => {
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

        const dateError = validatePaymentDate(form.when);
        if (dateError === 'past') {
            setError(formatMessage({
                id: 'online.pay.error.date.past',
                defaultMessage: 'Choose today or a future date',
            }));
            return;
        }
        if (dateError === 'too_far') {
            setError(formatMessage({
                id: 'online.pay.error.date.too_far',
                defaultMessage: 'Choose a date within the next 12 months',
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

        const applied = applyPayAnyonePayment({
            payeeName,
            payeeAccount: form.payeeAccount.trim(),
            fromAccountId: form.fromAccountId,
            amount,
            reference: form.reference.trim(),
            when: form.when,
        });
        if (!applied.ok) {
            if (applied.reason === 'past') {
                setError(formatMessage({
                    id: 'online.pay.error.date.past',
                    defaultMessage: 'Choose today or a future date',
                }));
                return;
            }
            if (applied.reason === 'too_far') {
                setError(formatMessage({
                    id: 'online.pay.error.date.too_far',
                    defaultMessage: 'Choose a date within the next 12 months',
                }));
                return;
            }
            setError(formatMessage({
                id: 'online.pay.error.funds',
                defaultMessage: 'There is not enough money in this account',
            }));
            return;
        }

        setState(applied.state);
        setResult(applied.payment);
        setError(null);
        setResetNotice(false);
    }, [available, form, formatMessage]);

    const handleAnother = useCallback(() => {
        setResult(null);
        setForm((current) => ({
            ...emptyForm(),
            fromAccountId: current.fromAccountId,
        }));
        setError(null);
    }, []);

    const handleReset = useCallback(() => {
        setState(resetPayAnyoneState());
        setResult(null);
        setForm(emptyForm());
        setError(null);
        setResetNotice(true);
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
                        defaultMessage='Pay now or pick a future date so the debit does not hit today'
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
                                        date: formatPaymentDateDisplay(result.when),
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
                    <form
                        className='PayAnyone__form'
                        onSubmit={handleSubmit}
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
                                min={minDate}
                                max={maxDate}
                                value={form.when}
                                onChange={handleFieldChange}
                                aria-describedby='pay-anyone-when-help'
                            />
                            <span
                                id='pay-anyone-when-help'
                                className='PayAnyone__help'
                            >
                                <FormattedMessage
                                    id='online.pay.date.help'
                                    defaultMessage='Today pays now. A later date schedules the payment and does not change today’s balance.'
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
                            type='submit'
                            emphasis='primary'
                        >
                            {isPayNow ? (
                                <FormattedMessage
                                    id='online.pay.submit'
                                    defaultMessage='Pay now'
                                />
                            ) : (
                                <FormattedMessage
                                    id='online.pay.submit.schedule'
                                    defaultMessage='Schedule'
                                />
                            )}
                        </Button>
                    </form>
                )}
                <section
                    className='PayAnyone__scheduled'
                    data-testid='pay-anyone-scheduled'
                    aria-labelledby='pay-anyone-scheduled-heading'
                >
                    <h3
                        id='pay-anyone-scheduled-heading'
                        className='PayAnyone__sectionTitle'
                    >
                        <FormattedMessage
                            id='online.pay.scheduled.heading'
                            defaultMessage='Scheduled payments'
                        />
                    </h3>
                    {scheduled.length === 0 ? (
                        <p className='PayAnyone__help'>
                            <FormattedMessage
                                id='online.pay.scheduled.empty'
                                defaultMessage='No scheduled payments'
                            />
                        </p>
                    ) : (
                        <ul className='PayAnyone__scheduledList'>
                            {scheduled.map((payment) => (
                                <li
                                    key={payment.id}
                                    data-testid='pay-anyone-scheduled-item'
                                >
                                    <FormattedMessage
                                        id='online.pay.scheduled.item'
                                        defaultMessage='{payee} · {amount} · {date} · from {account}'
                                        values={{
                                            payee: payment.payeeName,
                                            amount: (
                                                <FormattedNumber
                                                    value={payment.amount}

                                                    // eslint-disable-next-line react/style-prop-object
                                                    style='currency'
                                                    currency={PAY_ANYONE_CURRENCY}
                                                />
                                            ),
                                            date: formatPaymentDateDisplay(payment.when),
                                            account: accountName(payment.fromAccountId, formatMessage),
                                        }}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <section
                    className='PayAnyone__settings'
                    data-testid='pay-anyone-settings'
                    aria-labelledby='pay-anyone-settings-heading'
                >
                    <h3
                        id='pay-anyone-settings-heading'
                        className='PayAnyone__sectionTitle'
                    >
                        <FormattedMessage
                            id='online.pay.settings'
                            defaultMessage='Settings'
                        />
                    </h3>
                    <p className='PayAnyone__help'>
                        <FormattedMessage
                            id='online.pay.settings.help'
                            defaultMessage='Reset the demo to clear scheduled payments and restore account balances.'
                        />
                    </p>
                    <Button
                        type='button'
                        emphasis='tertiary'
                        onClick={handleReset}
                    >
                        <FormattedMessage
                            id='online.pay.reset'
                            defaultMessage='Reset demo'
                        />
                    </Button>
                    {resetNotice && (
                        <p
                            className='PayAnyone__help'
                            role='status'
                            data-testid='pay-anyone-reset-notice'
                        >
                            <FormattedMessage
                                id='online.pay.reset.done'
                                defaultMessage='Scheduled payments cleared'
                            />
                        </p>
                    )}
                </section>
            </div>
        </div>
    );
}
