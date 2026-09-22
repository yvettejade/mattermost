// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {
    addPayee,
    listPayees,
    removePayee,
    SEED_PAYEES,
    type Payee,
} from './payees';

import './pay_anyone.scss';

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

export default function PayAnyone() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [payees, setPayees] = useState<Payee[]>(() => listPayees());
    const [selectedPayeeId, setSelectedPayeeId] = useState(SEED_PAYEES[0].id);
    const [adding, setAdding] = useState(false);
    const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD_FORM);
    const [fieldError, setFieldError] = useState<{field: 'name' | 'accountNumber'; message: string} | null>(null);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const selectedPayee = useMemo(
        () => payees.find((payee) => payee.id === selectedPayeeId) ?? payees[0],
        [payees, selectedPayeeId],
    );

    const handleSelectPayee = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedPayeeId(event.target.value);
    }, []);

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

        const result = addPayee(addForm);
        if (!result.ok) {
            setFieldError({
                field: result.field,
                message: result.field === 'name' ? formatMessage({
                    id: 'online.pay.error.name',
                    defaultMessage: 'Enter the payee name',
                }) : formatMessage({
                    id: 'online.pay.error.account',
                    defaultMessage: 'Enter a valid account number like 12-3456-7890123-00',
                }),
            });
            return;
        }

        setPayees(result.payees);
        setSelectedPayeeId(result.payee.id);
        setAdding(false);
        setAddForm(EMPTY_ADD_FORM);
        setFieldError(null);
    }, [addForm, formatMessage]);

    const handleRemovePayee = useCallback((payeeId: string) => {
        const result = removePayee(payeeId);
        setPayees(result.payees);
        setSelectedPayeeId((current) => (
            current === payeeId ? (result.payees[0]?.id ?? SEED_PAYEES[0].id) : current
        ));
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
                        defaultMessage='Choose a saved payee or add a new one'
                    />
                }
            />
            <div className='PayAnyone__body'>
                <fieldset
                    className='PayAnyone__payTo'
                    data-testid='pay-anyone-pay-to'
                >
                    <legend className='PayAnyone__sectionTitle'>
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
                                        checked={selectedPayee.id === payee.id}
                                        onChange={handleSelectPayee}
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
                        <h3 className='PayAnyone__sectionTitle'>
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
                {selectedPayee && (
                    <section
                        className='PayAnyone__selected'
                        data-testid='pay-anyone-selected'
                        aria-live='polite'
                    >
                        <h3 className='PayAnyone__sectionTitle'>
                            <FormattedMessage
                                id='online.pay.selected.heading'
                                defaultMessage='Selected payee'
                            />
                        </h3>
                        <p className='PayAnyone__selectedName'>{selectedPayee.name}</p>
                        <p className='PayAnyone__payeeAccount'>{selectedPayee.accountNumber}</p>
                        {selectedPayee.referenceDefault && (
                            <p className='PayAnyone__payeeReference'>
                                <FormattedMessage
                                    id='online.pay.selected.reference'
                                    defaultMessage='Reference default: {reference}'
                                    values={{reference: selectedPayee.referenceDefault}}
                                />
                            </p>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}
