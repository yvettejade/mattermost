// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import Toggle from 'components/toggle';

import {ONLINE_URL_SUFFIX} from 'utils/constants';

import {findCard, formatNzdFromCents, setCardLocked} from './store';
import type {CardId, CardsPaymentsState} from './types';

type Props = {
    state: CardsPaymentsState;
    onStateChange: (state: CardsPaymentsState) => void;
};

export default function Overview({state, onStateChange}: Props) {
    const {formatMessage} = useIntl();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';
    const baseUrl = currentTeamName ? `/${currentTeamName}/${ONLINE_URL_SUFFIX}` : `/${ONLINE_URL_SUFFIX}`;

    const handleLockToggle = useCallback((cardId: CardId) => {
        const card = findCard(state.cards, cardId);
        if (!card) {
            return;
        }
        onStateChange(setCardLocked(state, cardId, !card.locked));
    }, [onStateChange, state]);

    return (
        <div className='Online__overview'>
            <section aria-labelledby='online-overview-cards-heading'>
                <h3
                    id='online-overview-cards-heading'
                    className='Online__sectionTitle'
                >
                    <FormattedMessage
                        id='online.overview.cards'
                        defaultMessage='Cards'
                    />
                </h3>
                <ul
                    className='Online__accounts'
                    data-testid='online-overview-cards'
                >
                    {state.cards.map((card) => (
                        <li
                            key={card.id}
                            className={classNames('Online__account', {locked: card.locked})}
                            data-testid='online-overview-card'
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
                                <span className={classNames('Online__badge', {locked: card.locked})}>
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
                            <div className='Online__toggle'>
                                <span id={`online-overview-lock-${card.id}`}>
                                    <FormattedMessage
                                        id='online.card.lock'
                                        defaultMessage='Lock card'
                                    />
                                </span>
                                <Toggle
                                    id={`online-overview-lock-toggle-${card.id}`}
                                    ariaLabel={formatMessage({
                                        id: 'online.card.lock',
                                        defaultMessage: 'Lock card',
                                    })}
                                    size='btn-md'
                                    onToggle={() => handleLockToggle(card.id)}
                                    toggled={card.locked}
                                    toggleClassName='btn-toggle-primary'
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
            <section aria-labelledby='online-overview-payments-heading'>
                <div className='Online__toolbar'>
                    <h3
                        id='online-overview-payments-heading'
                        className='Online__sectionTitle'
                    >
                        <FormattedMessage
                            id='online.overview.payments'
                            defaultMessage='Recent payments'
                        />
                    </h3>
                    <Link
                        className='Online__navLink'
                        to={`${baseUrl}/pay`}
                    >
                        <FormattedMessage
                            id='online.overview.pay_anyone'
                            defaultMessage='Pay anyone'
                        />
                    </Link>
                </div>
                {state.payments.length === 0 ? (
                    <p
                        className='Online__muted'
                        data-testid='online-overview-payments-empty'
                    >
                        <FormattedMessage
                            id='online.overview.payments.empty'
                            defaultMessage='No payments yet. New payees and scheduled payments show here after you confirm them.'
                        />
                    </p>
                ) : (
                    <ul
                        className='Online__list'
                        data-testid='online-overview-payments'
                    >
                        {state.payments.slice(0, 5).map((payment) => (
                            <li
                                key={payment.id}
                                className='Online__row'
                            >
                                <div>
                                    <p className='Online__accountName'>{payment.payeeName}</p>
                                    <p className='Online__muted'>
                                        {payment.status === 'scheduled' ? (
                                            <FormattedMessage
                                                id='online.overview.payment.scheduled'
                                                defaultMessage='Scheduled for {date}'
                                                values={{date: payment.when}}
                                            />
                                        ) : (
                                            <FormattedMessage
                                                id='online.overview.payment.sent'
                                                defaultMessage='Sent {date}'
                                                values={{date: payment.when}}
                                            />
                                        )}
                                    </p>
                                </div>
                                <span>{formatNzdFromCents(payment.amountCents)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <p className='Online__muted'>
                <FormattedMessage
                    id='online.overview.international'
                    defaultMessage='Need to send money overseas? See an <a>indicative international quote</a> before you log on.'
                    values={{
                        a: (chunks: React.ReactNode) => (
                            <Link to='/international'>{chunks}</Link>
                        ),
                    }}
                />
            </p>
        </div>
    );
}
