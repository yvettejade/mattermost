// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, FormattedNumber, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import {
    addPayee,
    listPayees,
    removePayee,
    SEED_PAYEES,
    type Payee,
} from './payees';
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

type FormState = {
    fromAccountId: string;
    amount: string;
    reference: string;
    when: string;
};

type AddForm = {
    name: string;
    accountNumber: string;
    referenceDefault: string;
};

const EMPTY_ADD_FORM: AddForm = {
    name: '',
    accountNumber: '',
    referenceDefault: '',
};

function parseAmount(value: string): number {
    return Number.parseFloat(value);
}

export default function Pay() {
    const {formatMessage} = useIntl();
    const confirmRef = useRef<HTMLElement>(null);
    const payButtonRef = useRef<HTMLButtonElement>(null);

    const [payees, setPayees] = useState<Payee[]>(() => listPayees());
    const [selectedPayeeId, setSelectedPayeeId] = useState(SEED_PAYEES[0].id);
    const [adding, setAdding] = useState(false);
    const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD_FORM);
    const [fieldError, setFieldError] = useState<{field: 'name' | 'accountNumber'; message: string} | null>(null);
    const [form, setForm] = useState<FormState>({
        fromAccountId: PAY_FROM_ACCOUNTS[0].id,
        amount: '',
        reference: SEED_PAYEES[0].referenceDefault,
        when: '',
    });
    const [balances, setBalances] = useState<Record<string, number>>(() => (
        Object.fromEntries(PAY_FROM_ACCOUNTS.map((account) => [account.id, getAccountBalance(account.id)]))
    ));
    const [pending, setPending] = useState<PayAnyoneDraft | null>(null);
    const [result, setResult] = useState<PayAnyonePayment | null>(null);
    const [error, setError] = useState<string | null>(null);

    const selectedPayee = useMemo(
        () => payees.find((payee) => payee.id === selectedPayeeId) ?? payees[0],
        [payees, selectedPayeeId],
    );

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

    const handleSelectPayee = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const nextId = event.target.value;
        const nextPayee = payees.find((payee) => payee.id === nextId);
        setSelectedPayeeId(nextId);
        setForm((current) => ({
            ...current,
            reference: nextPayee?.referenceDefault ?? '',
        }));
        setError(null);
        setPending(null);
    }, [payees]);

    const handleAddFieldChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = event.target;
        setAddForm((current) => ({...current, [name]: value}));
        setFieldError(null);
    }, []);

    const handleOpenAdd = useCallback(() => {
        setAdding(true);
        setAddForm(EMPTY_ADD_FORM);
        setFieldError(null);
    }, []);

    const handleCancelAdd = useCallback(() => {
        setAdding(false);
        setAddForm(EMPTY_ADD_FORM);
        setFieldError(null);
    }, []);

    const handleSavePayee = useCallback((event: React.FormEvent) => {
        event.preventDefault();

        const addResult = addPayee(addForm);
        if (!addResult.ok) {
            setFieldError({
                field: addResult.field,
                message: addResult.field === 'name' ? formatMessage({
                    id: 'online.pay.error.name',
                    defaultMessage: 'Enter the payee name',
                }) : formatMessage({
                    id: 'online.pay.error.account',
                    defaultMessage: 'Enter a valid account number like 12-3456-7890123-00',
                }),
            });
            return;
        }

        setPayees(addResult.payees);
        setSelectedPayeeId(addResult.payee.id);
        setForm((current) => ({
            ...current,
            reference: addResult.payee.referenceDefault,
        }));
        setAdding(false);
        setAddForm(EMPTY_ADD_FORM);
        setFieldError(null);
    }, [addForm, formatMessage]);

    const handleRemovePayee = useCallback((payeeId: string) => {
        const removed = removePayee(payeeId);
        setPayees(removed.payees);
        setSelectedPayeeId((current) => {
            if (current !== payeeId) {
                return current;
            }
            const next = removed.payees[0] ?? SEED_PAYEES[0];
            setForm((formState) => ({
                ...formState,
                reference: next.referenceDefault,
            }));
            return next.id;
        });
    }, []);

    const handleFieldChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const {name, value} = event.target;
        setForm((current) => ({...current, [name]: value}));
        setError(null);
    }, []);

    const handleReview = useCallback((event: React.FormEvent) => {
        event.preventDefault();

        if (!selectedPayee) {
            setError(formatMessage({
                id: 'online.pay.error.payee',
                defaultMessage: 'Choose a payee',
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
            payeeName: selectedPayee.name,
            payeeAccount: selectedPayee.accountNumber,
            fromAccountId: form.fromAccountId,
            amount,
            reference: form.reference.trim(),
            when: form.when,
            newPayee: !selectedPayee.seeded,
        });
    }, [available, form, formatMessage, selectedPayee]);

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
            fromAccountId: current.fromAccountId,
            amount: '',
            reference: selectedPayee?.referenceDefault ?? '',
            when: '',
        }));
        setError(null);
    }, [selectedPayee]);

    if (result) {
        return (
            <section
                className='PayAnyone__success'
                data-testid='pay-anyone-success'
                aria-live='polite'
            >
                <h3 className='Online__sectionTitle'>
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
        );
    }

    return (
        <div className='PayAnyone'>
            <fieldset
                className='PayAnyone__payTo'
                data-testid='pay-anyone-pay-to'
            >
                <legend className='Online__sectionTitle'>
                    <FormattedMessage
                        id='online.pay.to'
                        defaultMessage='Pay to'
                    />
                </legend>
                <ul className='PayAnyone__payeeList'>
                    {payees.map((payee) => (
                        <li
                            key={payee.id}
                            className='PayAnyone__payee'
                            data-testid={`pay-anyone-payee-${payee.id}`}
                        >
                            <div className='PayAnyone__payeeMain'>
                                <input
                                    id={`pay-anyone-payee-${payee.id}`}
                                    type='radio'
                                    name='payeeId'
                                    value={payee.id}
                                    checked={selectedPayee?.id === payee.id}
                                    onChange={handleSelectPayee}
                                    disabled={Boolean(pending)}
                                    aria-describedby={`pay-anyone-payee-account-${payee.id}`}
                                />
                                <label htmlFor={`pay-anyone-payee-${payee.id}`}>
                                    <span className='PayAnyone__payeeName'>{payee.name}</span>
                                </label>
                                <span
                                    id={`pay-anyone-payee-account-${payee.id}`}
                                    className='PayAnyone__payeeAccount'
                                >
                                    {payee.accountNumber}
                                </span>
                                {payee.referenceDefault && (
                                    <span className='PayAnyone__payeeReference'>
                                        {payee.referenceDefault}
                                    </span>
                                )}
                            </div>
                            {payee.seeded ? (
                                <span className='PayAnyone__help'>
                                    <FormattedMessage
                                        id='online.pay.seed.readonly'
                                        defaultMessage='Saved payee'
                                    />
                                </span>
                            ) : (
                                <Button
                                    type='button'
                                    emphasis='tertiary'
                                    aria-label={formatMessage({
                                        id: 'online.pay.remove',
                                        defaultMessage: 'Remove {name}',
                                    }, {name: payee.name})}
                                    onClick={() => handleRemovePayee(payee.id)}
                                    disabled={Boolean(pending)}
                                >
                                    <FormattedMessage
                                        id='online.pay.remove.label'
                                        defaultMessage='Remove'
                                    />
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
                {!adding && (
                    <Button
                        type='button'
                        emphasis='tertiary'
                        onClick={handleOpenAdd}
                        disabled={Boolean(pending)}
                    >
                        <FormattedMessage
                            id='online.pay.add'
                            defaultMessage='Add a payee'
                        />
                    </Button>
                )}
            </fieldset>
            {adding && (
                <form
                    className='PayAnyone__form'
                    data-testid='pay-anyone-add-form'
                    onSubmit={handleSavePayee}
                >
                    <h3 className='Online__sectionTitle'>
                        <FormattedMessage
                            id='online.pay.add.heading'
                            defaultMessage='Add a payee'
                        />
                    </h3>
                    <div className='PayAnyone__field'>
                        <label
                            className='PayAnyone__label'
                            htmlFor='pay-anyone-payee-name'
                        >
                            <FormattedMessage
                                id='online.pay.payee.name'
                                defaultMessage='Name'
                            />
                        </label>
                        <input
                            id='pay-anyone-payee-name'
                            className='PayAnyone__control'
                            name='name'
                            value={addForm.name}
                            onChange={handleAddFieldChange}
                            aria-invalid={fieldError?.field === 'name'}
                            aria-describedby={fieldError?.field === 'name' ? 'pay-anyone-name-error' : undefined}
                        />
                        {fieldError?.field === 'name' && (
                            <p
                                id='pay-anyone-name-error'
                                className='PayAnyone__error'
                                role='alert'
                            >
                                {fieldError.message}
                            </p>
                        )}
                    </div>
                    <div className='PayAnyone__field'>
                        <label
                            className='PayAnyone__label'
                            htmlFor='pay-anyone-account-number'
                        >
                            <FormattedMessage
                                id='online.pay.payee.account'
                                defaultMessage='Account number'
                            />
                        </label>
                        <input
                            id='pay-anyone-account-number'
                            className='PayAnyone__control'
                            name='accountNumber'
                            value={addForm.accountNumber}
                            onChange={handleAddFieldChange}
                            placeholder='12-3456-7890123-00'
                            aria-invalid={fieldError?.field === 'accountNumber'}
                            aria-describedby={fieldError?.field === 'accountNumber' ? 'pay-anyone-account-error pay-anyone-account-help' : 'pay-anyone-account-help'}
                        />
                        <span
                            id='pay-anyone-account-help'
                            className='PayAnyone__help'
                        >
                            <FormattedMessage
                                id='online.pay.payee.account.help'
                                defaultMessage='Use the format 12-3456-7890123-00'
                            />
                        </span>
                        {fieldError?.field === 'accountNumber' && (
                            <p
                                id='pay-anyone-account-error'
                                className='PayAnyone__error'
                                role='alert'
                            >
                                {fieldError.message}
                            </p>
                        )}
                    </div>
                    <div className='PayAnyone__field'>
                        <label
                            className='PayAnyone__label'
                            htmlFor='pay-anyone-reference-default'
                        >
                            <FormattedMessage
                                id='online.pay.payee.reference'
                                defaultMessage='Reference default'
                            />
                        </label>
                        <input
                            id='pay-anyone-reference-default'
                            className='PayAnyone__control'
                            name='referenceDefault'
                            value={addForm.referenceDefault}
                            onChange={handleAddFieldChange}
                            aria-describedby='pay-anyone-reference-help'
                        />
                        <span
                            id='pay-anyone-reference-help'
                            className='PayAnyone__help'
                        >
                            <FormattedMessage
                                id='online.pay.payee.reference.help'
                                defaultMessage='Optional. Used when you pay this person'
                            />
                        </span>
                    </div>
                    <div className='PayAnyone__confirmActions'>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            onClick={handleCancelAdd}
                        >
                            <FormattedMessage
                                id='online.pay.add.cancel'
                                defaultMessage='Cancel'
                            />
                        </Button>
                        <Button
                            type='submit'
                            emphasis='primary'
                        >
                            <FormattedMessage
                                id='online.pay.add.save'
                                defaultMessage='Save payee'
                            />
                        </Button>
                    </div>
                </form>
            )}
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
                        className='Online__sectionTitle'
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
                                    id='online.pay.confirm.account'
                                    defaultMessage='Account'
                                />
                            </dt>
                            <dd>{pending.payeeAccount}</dd>
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
                                defaultMessage='ANZ will never ask you to transfer money to keep an account safe. Treat investment opportunities and anyone who pressures you to pay a new or unusual payee as a scam.'
                            />
                        </p>
                        {pending.newPayee && (
                            <p>
                                <FormattedMessage
                                    id='online.pay.warning.new_payee'
                                    defaultMessage='This is a new payee. Confirm the account number with the person you intend to pay.'
                                />
                            </p>
                        )}
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
        </div>
    );
}
