// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {SITE_SEARCH_URL_SUFFIX} from 'utils/constants';

import './calculators.scss';

const CALCULATOR_SECTIONS = [
    {
        id: 'repayments',
        title: {id: 'calculators.repayments.title', defaultMessage: 'Repayments'},
        body: {id: 'calculators.repayments.body', defaultMessage: 'Estimate weekly, fortnightly, or monthly loan repayments.'},
    },
    {
        id: 'borrowing',
        title: {id: 'calculators.borrowing.title', defaultMessage: 'Borrowing power'},
        body: {id: 'calculators.borrowing.body', defaultMessage: 'Estimate how much you may be able to borrow.'},
    },
    {
        id: 'savings-goal',
        title: {id: 'calculators.savings_goal.title', defaultMessage: 'Savings goal'},
        body: {id: 'calculators.savings_goal.body', defaultMessage: 'Plan deposits to reach a savings target.'},
    },
    {
        id: 'foreign-exchange',
        title: {id: 'calculators.foreign_exchange.title', defaultMessage: 'Foreign exchange'},
        body: {id: 'calculators.foreign_exchange.body', defaultMessage: 'Convert currencies and estimate transfer costs.'},
    },
] as const;

export default function Calculators() {
    const dispatch = useDispatch();
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';

    useEffect(() => {
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const handleOpenSiteSearch = useCallback(() => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}/${SITE_SEARCH_URL_SUFFIX}`);
    }, [currentTeamName, history]);

    return (
        <div
            id='app-content'
            className='Calculators app__content'
        >
            <Header
                level={2}
                className='Calculators__header'
                heading={
                    <FormattedMessage
                        id='calculators.heading'
                        defaultMessage='Calculators'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='calculators.subtitle'
                        defaultMessage='Tools for repayments, borrowing power, savings, and foreign exchange'
                    />
                }
                right={
                    <Button
                        emphasis='tertiary'
                        onClick={handleOpenSiteSearch}
                    >
                        <FormattedMessage
                            id='calculators.site_search'
                            defaultMessage='Site search'
                        />
                    </Button>
                }
            />
            <ul className='Calculators__list'>
                {CALCULATOR_SECTIONS.map((section) => (
                    <li
                        key={section.id}
                        id={section.id}
                        className='Calculators__item'
                    >
                        <h3 className='Calculators__itemTitle'>
                            <FormattedMessage {...section.title}/>
                        </h3>
                        <p className='Calculators__itemBody'>
                            <FormattedMessage {...section.body}/>
                        </p>
                    </li>
                ))}
            </ul>
        </div>
    );
}
