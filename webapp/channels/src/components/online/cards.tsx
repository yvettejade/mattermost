// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import Toggle from 'components/toggle';

import {findCard, resetCardsPaymentsState, setCardLocked} from './store';
import type {CardId, CardsPaymentsState} from './types';

type Props = {
    state: CardsPaymentsState;
    onStateChange: (state: CardsPaymentsState) => void;
};

export default function Cards({state, onStateChange}: Props) {
    const {formatMessage} = useIntl();
    const [toast, setToast] = useState<string | null>(null);

    const handleReset = useCallback(() => {
        onStateChange(resetCardsPaymentsState());
        setToast(formatMessage({
            id: 'online.card.toast.reset',
            defaultMessage: 'Cards unlocked',
        }));
    }, [formatMessage, onStateChange]);

    const handleLockToggle = useCallback((cardId: CardId, cardName: string) => {
        const card = findCard(state.cards, cardId);
        if (!card) {
            return;
        }
        const nextLocked = !card.locked;
        onStateChange(setCardLocked(state, cardId, nextLocked));
        setToast(formatMessage(
            nextLocked ? {
                id: 'online.card.toast.lock.on',
                defaultMessage: '{card} locked',
            } : {
                id: 'online.card.toast.lock.off',
                defaultMessage: '{card} unlocked',
            },
            {card: cardName},
        ));
    }, [formatMessage, onStateChange, state]);

    return (
        <section aria-labelledby='online-cards-heading'>
            <div className='Online__toolbar'>
                <h3
                    id='online-cards-heading'
                    className='Online__sectionTitle'
                >
                    <FormattedMessage
                        id='online.card.heading'
                        defaultMessage='Lock or unlock a card'
                    />
                </h3>
                <Button
                    type='button'
                    emphasis='tertiary'
                    size='sm'
                    onClick={handleReset}
                >
                    <FormattedMessage
                        id='online.card.reset'
                        defaultMessage='Reset'
                    />
                </Button>
            </div>
            {toast && (
                <p
                    className='Online__toast'
                    role='status'
                    data-testid='online-cards-toast'
                >
                    {toast}
                </p>
            )}
            <ul
                className='Online__accounts'
                data-testid='online-cards'
            >
                {state.cards.map((card) => (
                    <li
                        key={card.id}
                        className={classNames('Online__account', 'Online__card', {locked: card.locked})}
                        data-testid='online-card'
                        data-card-id={card.id}
                        data-locked={card.locked ? 'true' : 'false'}
                    >
                        <div className='Online__cardTitleRow'>
                            <h4 className='Online__accountName'>
                                <FormattedMessage
                                    id={card.nameId}
                                    defaultMessage={card.name}
                                />
                            </h4>
                            <span
                                className={classNames('Online__badge', {locked: card.locked})}
                                data-testid='online-card-status'
                            >
                                {card.locked ? (
                                    <FormattedMessage
                                        id='online.card.status.locked'
                                        defaultMessage='Locked'
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='online.card.status.active'
                                        defaultMessage='Active'
                                    />
                                )}
                            </span>
                        </div>
                        <p className='Online__accountNumber'>
                            <FormattedMessage
                                id='online.card.last_four'
                                defaultMessage='•••• {lastFour}'
                                values={{lastFour: card.lastFour}}
                            />
                        </p>
                        {card.locked && (
                            <p className='Online__muted'>
                                <FormattedMessage
                                    id='online.card.locked.help'
                                    defaultMessage='Unlock this card if you find it.'
                                />
                            </p>
                        )}
                        <div className='Online__toggle'>
                            <span id={`online-cards-lock-${card.id}`}>
                                <FormattedMessage
                                    id='online.card.lock'
                                    defaultMessage='Lock card'
                                />
                            </span>
                            <Toggle
                                id={`online-cards-lock-toggle-${card.id}`}
                                ariaLabel={formatMessage({
                                    id: 'online.card.lock',
                                    defaultMessage: 'Lock card',
                                })}
                                size='btn-md'
                                onToggle={() => handleLockToggle(card.id, card.name)}
                                toggled={card.locked}
                                toggleClassName='btn-toggle-primary'
                            />
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
