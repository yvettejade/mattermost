// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Toggle from 'components/toggle';
import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {
    formatDailyLimitInput,
    formatNzdFromCents,
    loadCardControlsState,
    parseDailyLimitCents,
    resetCardControlsState,
    SEEDED_CARDS,
    updateCardControls,
} from './cards';
import type {CardControlsState, CardId} from './types';

import './online_cards.scss';

function dailyLimitDraftsFromState(state: CardControlsState): Record<CardId, string> {
    return {
        'flexi-debit': formatDailyLimitInput(state['flexi-debit'].dailyLimitCents),
        credit: formatDailyLimitInput(state.credit.dailyLimitCents),
    };
}

export default function OnlineCards() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [state, setState] = useState<CardControlsState>(loadCardControlsState);
    const [limitDrafts, setLimitDrafts] = useState<Record<CardId, string>>(() => dailyLimitDraftsFromState(loadCardControlsState()));
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const showToast = useCallback((message: string) => {
        setToast(message);
    }, []);

    const handleReset = useCallback(() => {
        const next = resetCardControlsState();
        setState(next);
        setLimitDrafts(dailyLimitDraftsFromState(next));
        showToast(formatMessage({
            id: 'online_cards.toast.reset',
            defaultMessage: 'Card controls reset to defaults',
        }));
    }, [formatMessage, showToast]);

    const handleLockToggle = useCallback((cardId: CardId, cardName: string) => {
        const nextLocked = !state[cardId].locked;
        setState(updateCardControls(cardId, {locked: nextLocked}));
        showToast(formatMessage(
            nextLocked ? {
                id: 'online_cards.toast.lock.on',
                defaultMessage: '{card} locked',
            } : {
                id: 'online_cards.toast.lock.off',
                defaultMessage: '{card} unlocked',
            },
            {card: cardName},
        ));
    }, [formatMessage, showToast, state]);

    const handleOverseasToggle = useCallback((cardId: CardId, cardName: string) => {
        if (state[cardId].locked) {
            return;
        }

        const nextBlocked = !state[cardId].blockOverseas;
        setState(updateCardControls(cardId, {blockOverseas: nextBlocked}));
        showToast(formatMessage(
            nextBlocked ? {
                id: 'online_cards.toast.block_overseas.on',
                defaultMessage: 'Overseas spend blocked on {card}',
            } : {
                id: 'online_cards.toast.block_overseas.off',
                defaultMessage: 'Overseas spend allowed on {card}',
            },
            {card: cardName},
        ));
    }, [formatMessage, showToast, state]);

    const handleOnlineToggle = useCallback((cardId: CardId, cardName: string) => {
        if (state[cardId].locked) {
            return;
        }

        const nextBlocked = !state[cardId].blockOnline;
        setState(updateCardControls(cardId, {blockOnline: nextBlocked}));
        showToast(formatMessage(
            nextBlocked ? {
                id: 'online_cards.toast.block_online.on',
                defaultMessage: 'Online spend blocked on {card}',
            } : {
                id: 'online_cards.toast.block_online.off',
                defaultMessage: 'Online spend allowed on {card}',
            },
            {card: cardName},
        ));
    }, [formatMessage, showToast, state]);

    const handleLimitDraftChange = useCallback((cardId: CardId, value: string) => {
        setLimitDrafts((current) => ({
            ...current,
            [cardId]: value,
        }));
    }, []);

    const applyDailyLimit = useCallback((cardId: CardId, cardName: string) => {
        if (state[cardId].locked) {
            return;
        }

        const parsed = parseDailyLimitCents(limitDrafts[cardId]);
        if (!parsed.ok) {
            setLimitDrafts((current) => ({
                ...current,
                [cardId]: formatDailyLimitInput(state[cardId].dailyLimitCents),
            }));
            showToast(formatMessage({
                id: 'online_cards.toast.invalid_limit',
                defaultMessage: 'Enter a daily limit greater than zero, or leave it empty.',
            }));
            return;
        }

        if (parsed.value === state[cardId].dailyLimitCents) {
            setLimitDrafts((current) => ({
                ...current,
                [cardId]: formatDailyLimitInput(parsed.value),
            }));
            return;
        }

        setState(updateCardControls(cardId, {dailyLimitCents: parsed.value}));
        setLimitDrafts((current) => ({
            ...current,
            [cardId]: formatDailyLimitInput(parsed.value),
        }));
        showToast(parsed.value === null ? formatMessage(
            {
                id: 'online_cards.toast.daily_limit.cleared',
                defaultMessage: 'Daily limit removed on {card}',
            },
            {card: cardName},
        ) : formatMessage(
            {
                id: 'online_cards.toast.daily_limit.set',
                defaultMessage: 'Daily limit set to {amount} on {card}',
            },
            {
                amount: formatNzdFromCents(parsed.value),
                card: cardName,
            },
        ));
    }, [formatMessage, limitDrafts, showToast, state]);

    return (
        <div
            id='app-content'
            className='OnlineCards app__content'
        >
            <Header
                level={2}
                className='OnlineCards__header'
                heading={
                    <FormattedMessage
                        id='online_cards.heading'
                        defaultMessage='Cards'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='online_cards.subtitle'
                        defaultMessage='Lock a card or set overseas, online, and daily-limit controls'
                    />
                }
                right={
                    <div className='OnlineCards__headerActions'>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            size='sm'
                            onClick={handleReset}
                        >
                            <FormattedMessage
                                id='online_cards.reset'
                                defaultMessage='Reset'
                            />
                        </Button>
                    </div>
                }
            />
            <div className='OnlineCards__body'>
                {toast && (
                    <p
                        className='OnlineCards__toast'
                        role='status'
                        data-testid='online-cards-toast'
                    >
                        {toast}
                    </p>
                )}
                <ul
                    className='OnlineCards__list'
                    data-testid='online-cards'
                >
                    {SEEDED_CARDS.map((card) => {
                        const controls = state[card.id];
                        const limitId = `online-cards-daily-limit-${card.id}`;
                        const extraHelpId = `online-cards-locked-${card.id}`;

                        return (
                            <li
                                key={card.id}
                                className={classNames('OnlineCards__card', {locked: controls.locked})}
                                data-testid='online-card'
                                data-card-id={card.id}
                            >
                                <div className='OnlineCards__cardHeader'>
                                    <h3 className='OnlineCards__cardName'>
                                        <FormattedMessage
                                            id={card.nameId}
                                            defaultMessage={card.name}
                                        />
                                    </h3>
                                    <p className='OnlineCards__cardNumber'>
                                        <FormattedMessage
                                            id='online_cards.card.last_four'
                                            defaultMessage='•••• {lastFour}'
                                            values={{lastFour: card.lastFour}}
                                        />
                                    </p>
                                </div>
                                <div className='OnlineCards__control'>
                                    <span id={`online-cards-lock-${card.id}`}>
                                        <FormattedMessage
                                            id='online_cards.control.lock'
                                            defaultMessage='Lock card'
                                        />
                                    </span>
                                    <Toggle
                                        id={`online-cards-lock-toggle-${card.id}`}
                                        ariaLabel={formatMessage({
                                            id: 'online_cards.control.lock',
                                            defaultMessage: 'Lock card',
                                        })}
                                        size='btn-md'
                                        onToggle={() => handleLockToggle(card.id, card.name)}
                                        toggled={controls.locked}
                                        toggleClassName='btn-toggle-primary'
                                    />
                                </div>
                                <fieldset
                                    className='OnlineCards__spendControls'
                                    disabled={controls.locked}
                                    aria-describedby={controls.locked ? extraHelpId : undefined}
                                >
                                    <legend className='OnlineCards__spendLegend'>
                                        <FormattedMessage
                                            id='online_cards.spend_controls'
                                            defaultMessage='Spend controls'
                                        />
                                    </legend>
                                    {controls.locked && (
                                        <p
                                            id={extraHelpId}
                                            className='OnlineCards__lockedHelp'
                                        >
                                            <FormattedMessage
                                                id='online_cards.locked.explanation'
                                                defaultMessage='Unlock this card to change spend controls.'
                                            />
                                        </p>
                                    )}
                                    <div className='OnlineCards__control'>
                                        <span id={`online-cards-overseas-${card.id}`}>
                                            <FormattedMessage
                                                id='online_cards.control.block_overseas'
                                                defaultMessage='Block overseas'
                                            />
                                        </span>
                                        <Toggle
                                            id={`online-cards-overseas-toggle-${card.id}`}
                                            ariaLabel={formatMessage({
                                                id: 'online_cards.control.block_overseas',
                                                defaultMessage: 'Block overseas',
                                            })}
                                            size='btn-md'
                                            onToggle={() => handleOverseasToggle(card.id, card.name)}
                                            toggled={controls.blockOverseas}
                                            disabled={controls.locked}
                                            toggleClassName='btn-toggle-primary'
                                        />
                                    </div>
                                    <div className='OnlineCards__control'>
                                        <span id={`online-cards-online-${card.id}`}>
                                            <FormattedMessage
                                                id='online_cards.control.block_online'
                                                defaultMessage='Block online'
                                            />
                                        </span>
                                        <Toggle
                                            id={`online-cards-online-toggle-${card.id}`}
                                            ariaLabel={formatMessage({
                                                id: 'online_cards.control.block_online',
                                                defaultMessage: 'Block online',
                                            })}
                                            size='btn-md'
                                            onToggle={() => handleOnlineToggle(card.id, card.name)}
                                            toggled={controls.blockOnline}
                                            disabled={controls.locked}
                                            toggleClassName='btn-toggle-primary'
                                        />
                                    </div>
                                    <div className='OnlineCards__limit'>
                                        <label htmlFor={limitId}>
                                            <FormattedMessage
                                                id='online_cards.control.daily_limit'
                                                defaultMessage='Daily limit (NZD)'
                                            />
                                        </label>
                                        <input
                                            id={limitId}
                                            className='OnlineCards__limitInput'
                                            type='text'
                                            inputMode='decimal'
                                            value={limitDrafts[card.id]}
                                            placeholder={formatMessage({
                                                id: 'online_cards.control.daily_limit.placeholder',
                                                defaultMessage: 'No extra limit',
                                            })}
                                            disabled={controls.locked}
                                            aria-describedby={`${limitId}-help`}
                                            onChange={(event) => handleLimitDraftChange(card.id, event.target.value)}
                                            onBlur={() => applyDailyLimit(card.id, card.name)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    applyDailyLimit(card.id, card.name);
                                                }
                                            }}
                                        />
                                        <p
                                            id={`${limitId}-help`}
                                            className='OnlineCards__limitHelp'
                                        >
                                            <FormattedMessage
                                                id='online_cards.control.daily_limit.help'
                                                defaultMessage='Leave empty for no extra limit'
                                            />
                                        </p>
                                    </div>
                                </fieldset>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
