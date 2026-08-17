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

import AccountDetail from './account_detail';
import Overview from './overview';
import Settings from './settings';
import {loadEverydayMoneyState} from './store';
import type {EverydayMoneyState} from './types';

import './online.scss';

export default function Online() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';
    const baseUrl = currentTeamName ? `/${currentTeamName}/${ONLINE_URL_SUFFIX}` : `/${ONLINE_URL_SUFFIX}`;
    const [state, setState] = useState<EverydayMoneyState>(loadEverydayMoneyState);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const handleStateChange = useCallback((next: EverydayMoneyState) => {
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
                        defaultMessage='Everyday money'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='online.subtitle'
                        defaultMessage='Set a Rapid Save goal and track progress'
                    />
                }
                right={
                    <nav
                        className='Online__nav'
                        aria-label={formatMessage({
                            id: 'online.heading',
                            defaultMessage: 'Everyday money',
                        })}
                    >
                        <NavLink
                            className='Online__navLink'
                            exact={true}
                            to={baseUrl}
                        >
                            <FormattedMessage
                                id='online.nav.accounts'
                                defaultMessage='Accounts'
                            />
                        </NavLink>
                        <NavLink
                            className='Online__navLink'
                            to={`${baseUrl}/settings`}
                        >
                            <FormattedMessage
                                id='online.nav.settings'
                                defaultMessage='Settings'
                            />
                        </NavLink>
                    </nav>
                }
            />
            <div className='Online__body'>
                <Switch>
                    <Route
                        path={`/:team(${TEAM_NAME_PATH_PATTERN})/${ONLINE_URL_SUFFIX}/accounts/:accountId`}
                    >
                        <AccountDetail
                            state={state}
                            onStateChange={handleStateChange}
                        />
                    </Route>
                    <Route
                        path={`/:team(${TEAM_NAME_PATH_PATTERN})/${ONLINE_URL_SUFFIX}/settings`}
                    >
                        <Settings onStateChange={handleStateChange}/>
                    </Route>
                    <Route>
                        <Overview state={state}/>
                    </Route>
                </Switch>
            </div>
        </div>
    );
}
