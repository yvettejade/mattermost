// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {CALCULATORS_URL_SUFFIX} from 'utils/constants';

import {searchSiteIndex} from './site_search_index';
import type {SiteSearchEntry, SiteSearchKind} from './site_search_index';

import './site_search.scss';

const KIND_MESSAGES: Record<SiteSearchKind, {id: string; defaultMessage: string}> = {
    Product: {id: 'site_search.kind.product', defaultMessage: 'Product'},
    Support: {id: 'site_search.kind.support', defaultMessage: 'Support'},
    News: {id: 'site_search.kind.news', defaultMessage: 'News'},
    Locate: {id: 'site_search.kind.locate', defaultMessage: 'Locate'},
    Tool: {id: 'site_search.kind.tool', defaultMessage: 'Tool'},
};

export default function SiteSearch() {
    const dispatch = useDispatch();
    const history = useHistory();
    const intl = useIntl();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';
    const [query, setQuery] = useState('');

    useEffect(() => {
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const results = useMemo(() => searchSiteIndex(query), [query]);

    const handleOpenCalculators = useCallback(() => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}/${CALCULATORS_URL_SUFFIX}`);
    }, [currentTeamName, history]);

    const handleSelect = useCallback((entry: SiteSearchEntry) => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}${entry.href}`);
    }, [currentTeamName, history]);

    return (
        <div
            id='app-content'
            className='SiteSearch app__content'
        >
            <Header
                level={2}
                className='SiteSearch__header'
                heading={
                    <FormattedMessage
                        id='site_search.heading'
                        defaultMessage='Site search'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='site_search.subtitle'
                        defaultMessage='Find products, support, news, branches, and tools'
                    />
                }
                right={
                    <Button
                        emphasis='tertiary'
                        onClick={handleOpenCalculators}
                    >
                        <FormattedMessage
                            id='site_search.calculators'
                            defaultMessage='Calculators'
                        />
                    </Button>
                }
            />
            <div className='SiteSearch__body'>
                <label
                    className='SiteSearch__label'
                    htmlFor='site-search-input'
                >
                    <FormattedMessage
                        id='site_search.placeholder'
                        defaultMessage='Search the site'
                    />
                </label>
                <input
                    id='site-search-input'
                    className='SiteSearch__input'
                    type='search'
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={intl.formatMessage({
                        id: 'site_search.placeholder',
                        defaultMessage: 'Search the site',
                    })}
                />
                {query.trim() === '' ? (
                    <p className='SiteSearch__hint'>
                        <FormattedMessage
                            id='site_search.hint'
                            defaultMessage='Try repayments, borrowing power, or a product name.'
                        />
                    </p>
                ) : (
                    <ul className='SiteSearch__list'>
                        {results.length === 0 ? (
                            <li className='SiteSearch__empty'>
                                <FormattedMessage
                                    id='site_search.no_results'
                                    defaultMessage='No results'
                                />
                            </li>
                        ) : results.map((entry) => (
                            <li key={entry.id}>
                                <button
                                    type='button'
                                    className='SiteSearch__item'
                                    onClick={() => handleSelect(entry)}
                                >
                                    <span className='SiteSearch__kind'>
                                        <FormattedMessage {...KIND_MESSAGES[entry.kind]}/>
                                    </span>
                                    <span className='SiteSearch__itemTitle'>{entry.title}</span>
                                    <span className='SiteSearch__itemBody'>{entry.description}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
