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

import {loadCardLockState, resetCardLockState, SEEDED_CARDS, setCardLocked} from './cards';
import type {CardId, CardLockState} from './types';

import './online_cards.scss';

export default function OnlineCards() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [state, setState] = useState<CardLockState>(loadCardLockState);
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const handleReset = useCallback(() => {
        setState(resetCardLockState());
        setToast(formatMessage({
            id: 'online_cards.toast.reset',
            defaultMessage: 'Cards unlocked',
        }));
    }, [formatMessage]);

    const handleLockToggle = useCallback((cardId: CardId, cardName: string) => {
        const nextLocked = !state[cardId].locked;
        setState(setCardLocked(cardId, nextLocked));
        setToast(formatMessage(
            nextLocked ? {
                id: 'online_cards.toast.lock.on',
                defaultMessage: '{card} locked',
            } : {
                id: 'online_cards.toast.lock.off',
                defaultMessage: '{card} unlocked',
            },
            {card: cardName},
        ));
    }, [formatMessage, state]);

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
                        defaultMessage='Lock a missing Flexi Debit or credit card, or unlock it if it turns up'
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
                        const {locked} = state[card.id];

                        return (
                            <li
                                key={card.id}
                                className={classNames('OnlineCards__card', {locked})}
                                data-testid='online-card'
                                data-card-id={card.id}
                                data-locked={locked ? 'true' : 'false'}
                            >
                                <div className='OnlineCards__cardHeader'>
                                    <div className='OnlineCards__cardTitleRow'>
                                        <h3 className='OnlineCards__cardName'>
                                            <FormattedMessage
                                                id={card.nameId}
                                                defaultMessage={card.name}
                                            />
                                        </h3>
                                        <span
                                            className={classNames('OnlineCards__status', {locked})}
                                            data-testid='online-card-status'
                                        >
                                            {locked ? (
                                                <FormattedMessage
                                                    id='online_cards.status.locked'
                                                    defaultMessage='Locked'
                                                />
                                            ) : (
                                                <FormattedMessage
                                                    id='online_cards.status.active'
                                                    defaultMessage='Active'
                                                />
                                            )}
                                        </span>
                                    </div>
                                    <p className='OnlineCards__cardNumber'>
                                        <FormattedMessage
                                            id='online_cards.card.last_four'
                                            defaultMessage='•••• {lastFour}'
                                            values={{lastFour: card.lastFour}}
                                        />
                                    </p>
                                </div>
                                {locked && (
                                    <p className='OnlineCards__lockedHelp'>
                                        <FormattedMessage
                                            id='online_cards.locked.help'
                                            defaultMessage='Unlock this card if you find it.'
                                        />
                                    </p>
                                )}
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
                                        toggled={locked}
                                        toggleClassName='btn-toggle-primary'
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
