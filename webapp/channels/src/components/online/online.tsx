// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {NavLink, Route, Switch} from 'react-router-dom';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {ONLINE_URL_SUFFIX} from 'utils/constants';
import {TEAM_NAME_PATH_PATTERN} from 'utils/path';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import Cards from './cards';
import Overview from './overview';
import Pay from './pay';
import {loadCardsPaymentsState} from './store';
import Transfer from './transfer';
import type {CardsPaymentsState} from './types';

import './online.scss';

export default function Online() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';
    const baseUrl = currentTeamName ? `/${currentTeamName}/${ONLINE_URL_SUFFIX}` : `/${ONLINE_URL_SUFFIX}`;
    const [state, setState] = useState<CardsPaymentsState>(loadCardsPaymentsState);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const handleStateChange = useCallback((next: CardsPaymentsState) => {
        setState(next);
    }, []);

    return (
        <div
            id='app-content'
            className='Online app__content'
        >
            <Header
                level={2}
                className='Online__header'
                heading={
                    <FormattedMessage
                        id='online.heading'
                        defaultMessage='Cards, payments & scam controls'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='online.subtitle'
                        defaultMessage='Lock cards, confirm payments, and treat new payees as first-class'
                    />
                }
                right={
                    <nav
                        className='Online__nav'
                        aria-label={formatMessage({
                            id: 'online.heading',
                            defaultMessage: 'Cards, payments & scam controls',
                        })}
                    >
                        <NavLink
                            className='Online__navLink'
                            exact={true}
                            to={baseUrl}
                        >
                            <FormattedMessage
                                id='online.nav.overview'
                                defaultMessage='Overview'
                            />
                        </NavLink>
                        <NavLink
                            className='Online__navLink'
                            to={`${baseUrl}/cards`}
                        >
                            <FormattedMessage
                                id='online.nav.cards'
                                defaultMessage='Cards'
                            />
                        </NavLink>
                        <NavLink
                            className='Online__navLink'
                            to={`${baseUrl}/pay`}
                        >
                            <FormattedMessage
                                id='online.nav.pay'
                                defaultMessage='Pay'
                            />
                        </NavLink>
                        <NavLink
                            className='Online__navLink'
                            to={`${baseUrl}/transfer`}
                        >
                            <FormattedMessage
                                id='online.nav.transfer'
                                defaultMessage='Transfer'
                            />
                        </NavLink>
                    </nav>
                }
            />
            <div className='Online__body'>
                <Switch>
                    <Route
                        path={`/:team(${TEAM_NAME_PATH_PATTERN})/${ONLINE_URL_SUFFIX}/cards`}
                    >
                        <Cards
                            state={state}
                            onStateChange={handleStateChange}
                        />
                    </Route>
                    <Route
                        path={`/:team(${TEAM_NAME_PATH_PATTERN})/${ONLINE_URL_SUFFIX}/pay`}
                    >
                        <Pay
                            state={state}
                            onStateChange={handleStateChange}
                        />
                    </Route>
                    <Route
                        path={`/:team(${TEAM_NAME_PATH_PATTERN})/${ONLINE_URL_SUFFIX}/transfer`}
                    >
                        <Transfer
                            state={state}
                            onStateChange={handleStateChange}
                        />
                    </Route>
                    <Route>
                        <Overview
                            state={state}
                            onStateChange={handleStateChange}
                        />
                    </Route>
                </Switch>
            </div>
        </div>
    );
}
