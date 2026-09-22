// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useParams} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {
    findAccount,
    formatAudFromCents,
    goalProgressPercent,
    hasVisibleGoal,
    parseGoalAmountCents,
    saveSavingsGoal,
} from './store';
import {RAPID_SAVE_ACCOUNT_ID} from './types';
import type {EverydayMoneyState} from './types';

type Props = {
    state: EverydayMoneyState;
    onStateChange: (state: EverydayMoneyState) => void;
};

export default function AccountDetail({state, onStateChange}: Props) {
    const {formatMessage} = useIntl();
    const {accountId} = useParams<{accountId: string}>();
    const account = findAccount(state.accounts, accountId ?? '');
    const isRapidSave = account?.id === RAPID_SAVE_ACCOUNT_ID;
    const goal = isRapidSave ? state.goals[RAPID_SAVE_ACCOUNT_ID] : undefined;
    const showProgress = isRapidSave && hasVisibleGoal(goal);

    const [formOpen, setFormOpen] = useState(false);
    const [amount, setAmount] = useState(goal ? String(goal.amountCents / 100) : '');
    const [label, setLabel] = useState(goal?.label ?? '');
    const [error, setError] = useState(false);

    const handleOpenForm = useCallback(() => {
        setAmount(goal ? String(goal.amountCents / 100) : '');
        setLabel(goal?.label ?? '');
        setError(false);
        setFormOpen(true);
    }, [goal]);

    const handleSave = useCallback((event: React.FormEvent) => {
        event.preventDefault();
        if (!account) {
            return;
        }

        const amountCents = parseGoalAmountCents(amount);
        if (amountCents === null) {
            setError(true);
            return;
        }

        onStateChange(saveSavingsGoal(account.id, amountCents, label));
        setError(false);
        setFormOpen(false);
    }, [account, amount, label, onStateChange]);

    const handleClear = useCallback(() => {
        if (!account) {
            return;
        }

        onStateChange(saveSavingsGoal(account.id, 0, ''));
        setAmount('');
        setLabel('');
        setError(false);
        setFormOpen(false);
    }, [account, onStateChange]);

    if (!account) {
        return (
            <p className='Online__muted'>
                <FormattedMessage
                    id='online.account.not_found'
                    defaultMessage='That account is not available.'
                />
            </p>
        );
    }

    const percent = showProgress ? goalProgressPercent(account.availableCents, goal.amountCents) : 0;

    return (
        <>
            <section
                className='Online__detailHeader'
                aria-labelledby='online-account-detail-heading'
            >
                <h3
                    id='online-account-detail-heading'
                    className='Online__sectionTitle'
                >
                    <FormattedMessage
                        id={account.nameId}
                        defaultMessage={account.name}
                    />
                </h3>
                <p className='Online__accountNumber'>{account.number}</p>
                <p
                    className='Online__accountAvailable'
                    data-testid='online-account-available'
                >
                    {formatAudFromCents(account.availableCents)}
                </p>
                {showProgress && (
                    <div
                        className='Online__goalProgress'
                        data-testid='online-goal-progress'
                    >
                        {goal.label ? (
                            <p className='Online__goalLabel'>{goal.label}</p>
                        ) : null}
                        <p className='Online__goalCopy'>
                            <FormattedMessage
                                id='online.goal.of'
                                defaultMessage='{current} of {goal}'
                                values={{
                                    current: formatAudFromCents(account.availableCents),
                                    goal: formatAudFromCents(goal.amountCents),
                                }}
                            />
                        </p>
                        <div
                            className='Online__progress'
                            role='progressbar'
                            aria-label={formatMessage({
                                id: 'online.goal.progress',
                                defaultMessage: 'Savings goal progress',
                            })}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={percent}
                        >
                            <div
                                className='Online__progressFill'
                                style={{width: `${percent}%`}}
                            />
                        </div>
                    </div>
                )}
                {isRapidSave && !formOpen && (
                    <div className='Online__actions'>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            onClick={handleOpenForm}
                        >
                            <FormattedMessage
                                id='online.goal.set'
                                defaultMessage='Set a savings goal'
                            />
                        </Button>
                    </div>
                )}
            </section>
            {isRapidSave && formOpen && (
                <form
                    className='Online__form'
                    onSubmit={handleSave}
                    aria-labelledby='online-goal-heading'
                >
                    <h3
                        id='online-goal-heading'
                        className='Online__sectionTitle'
                    >
                        <FormattedMessage
                            id='online.goal.form'
                            defaultMessage='Savings goal'
                        />
                    </h3>
                    <div className='Online__field'>
                        <label
                            className='Online__label'
                            htmlFor='online-goal-amount'
                        >
                            <FormattedMessage
                                id='online.goal.amount'
                                defaultMessage='Amount'
                            />
                        </label>
                        <input
                            id='online-goal-amount'
                            inputMode='decimal'
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            placeholder={formatMessage({
                                id: 'online.goal.amount.placeholder',
                                defaultMessage: '0.00',
                            })}
                        />
                    </div>
                    <div className='Online__field'>
                        <label
                            className='Online__label'
                            htmlFor='online-goal-label'
                        >
                            <FormattedMessage
                                id='online.goal.label'
                                defaultMessage='Label'
                            />
                        </label>
                        <input
                            id='online-goal-label'
                            value={label}
                            onChange={(event) => setLabel(event.target.value)}
                            placeholder={formatMessage({
                                id: 'online.goal.label.placeholder',
                                defaultMessage: 'House deposit',
                            })}
                        />
                    </div>
                    {error && (
                        <p
                            className='Online__status'
                            role='alert'
                        >
                            <FormattedMessage
                                id='online.goal.error.invalid_amount'
                                defaultMessage='Enter an amount of zero or more, using up to two decimal places.'
                            />
                        </p>
                    )}
                    <div className='Online__actions'>
                        <Button type='submit'>
                            <FormattedMessage
                                id='online.goal.save'
                                defaultMessage='Save goal'
                            />
                        </Button>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            onClick={handleClear}
                        >
                            <FormattedMessage
                                id='online.goal.clear'
                                defaultMessage='Clear goal'
                            />
                        </Button>
                    </div>
                </form>
            )}
        </>
    );
}
