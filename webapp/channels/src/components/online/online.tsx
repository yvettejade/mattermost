// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Redirect, Route, Switch} from 'react-router-dom';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {ONLINE_URL_SUFFIX} from 'utils/constants';
import {TEAM_NAME_PATH_PATTERN} from 'utils/path';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import AccountDetail from './account_detail';
import {seedAccounts, seedTransactions} from './store';

import './online.scss';

export default function Online() {
    const dispatch = useDispatch();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';
    const baseUrl = currentTeamName ? `/${currentTeamName}/${ONLINE_URL_SUFFIX}` : `/${ONLINE_URL_SUFFIX}`;
    const accounts = useMemo(() => seedAccounts(), []);
    const transactions = useMemo(() => seedTransactions(), []);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

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
                        defaultMessage='Download the transactions you are looking at'
                    />
                }
            />
            <div className='Online__body'>
                <Switch>
                    <Route
                        path={`/:team(${TEAM_NAME_PATH_PATTERN})/${ONLINE_URL_SUFFIX}/accounts/:accountId`}
                    >
                        <AccountDetail
                            accounts={accounts}
                            transactions={transactions}
                        />
                    </Route>
                    <Redirect to={`${baseUrl}/accounts/everyday`}/>
                </Switch>
            </div>
        </div>
    );
}
