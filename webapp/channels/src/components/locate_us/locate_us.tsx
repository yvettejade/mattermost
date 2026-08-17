// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';

import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Toggle from 'components/toggle';
import Header from 'components/widgets/header';

import {
    filterLocations,
    LOCATE_US_LOCATIONS,
} from './locations';
import type {LocateLocation, LocationTypeFilter} from './locations';

import './locate_us.scss';

const TYPE_FILTERS: Array<{value: LocationTypeFilter; id: string; defaultMessage: string}> = [
    {value: 'all', id: 'locate_us.filter.all', defaultMessage: 'All'},
    {value: 'branch', id: 'locate_us.filter.branch', defaultMessage: 'Branch'},
    {value: 'atm', id: 'locate_us.filter.atm', defaultMessage: 'ATM'},
];

type Props = {
    now?: Date;
    locations?: readonly LocateLocation[];
};

export default function LocateUs({now, locations = LOCATE_US_LOCATIONS}: Props) {
    const dispatch = useDispatch();
    const intl = useIntl();
    const [typeFilter, setTypeFilter] = useState<LocationTypeFilter>('all');
    const [openNow, setOpenNow] = useState(false);
    const clock = now ?? new Date();

    useEffect(() => {
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const results = useMemo(
        () => filterLocations(locations, {type: typeFilter, openNow, now: clock}),
        [clock, locations, openNow, typeFilter],
    );

    return (
        <div
            id='app-content'
            className='LocateUs app__content'
        >
            <Header
                level={2}
                className='LocateUs__header'
                heading={
                    <FormattedMessage
                        id='locate_us.heading'
                        defaultMessage='Locate us'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='locate_us.subtitle'
                        defaultMessage='Find a branch or ATM without scrolling past closed stores'
                    />
                }
            />
            <div className='LocateUs__body'>
                <div
                    className='LocateUs__filters'
                    data-testid='locate-us-filters'
                >
                    <h3 className='LocateUs__mobileTitle'>
                        <FormattedMessage
                            id='locate_us.heading'
                            defaultMessage='Locate us'
                        />
                    </h3>
                    <div
                        className='LocateUs__chips'
                        role='radiogroup'
                        aria-label={intl.formatMessage({
                            id: 'locate_us.filter.type',
                            defaultMessage: 'Location type',
                        })}
                    >
                        {TYPE_FILTERS.map((filter) => (
                            <Button
                                key={filter.value}
                                type='button'
                                role='radio'
                                size='sm'
                                emphasis={typeFilter === filter.value ? 'primary' : 'tertiary'}
                                aria-checked={typeFilter === filter.value}
                                onClick={() => setTypeFilter(filter.value)}
                            >
                                <FormattedMessage
                                    id={filter.id}
                                    defaultMessage={filter.defaultMessage}
                                />
                            </Button>
                        ))}
                    </div>
                    <div className='LocateUs__openNow'>
                        <span id='locate-us-open-now-label'>
                            <FormattedMessage
                                id='locate_us.filter.open_now'
                                defaultMessage='Open now'
                            />
                        </span>
                        <Toggle
                            id='locate-us-open-now'
                            size='btn-sm'
                            toggled={openNow}
                            onToggle={() => setOpenNow((value) => !value)}
                            ariaLabel={intl.formatMessage({
                                id: 'locate_us.filter.open_now',
                                defaultMessage: 'Open now',
                            })}
                        />
                    </div>
                    <p
                        className='LocateUs__count'
                        aria-live='polite'
                    >
                        <FormattedMessage
                            id='locate_us.results'
                            defaultMessage='{count, plural, =0 {No locations} =1 {1 location} other {# locations}}'
                            values={{count: results.length}}
                        />
                    </p>
                </div>
                {results.length === 0 ? (
                    <div
                        className='LocateUs__empty'
                        role='status'
                    >
                        <p className='LocateUs__emptyTitle'>
                            <FormattedMessage
                                id='locate_us.empty'
                                defaultMessage='No locations match these filters'
                            />
                        </p>
                        <p className='LocateUs__emptyHint'>
                            <FormattedMessage
                                id='locate_us.empty.hint'
                                defaultMessage='Try All, or turn off Open now.'
                            />
                        </p>
                    </div>
                ) : (
                    <ul className='LocateUs__list'>
                        {results.map((location) => (
                            <li
                                key={location.id}
                                className='LocateUs__card'
                                data-location={location.id}
                                data-type={location.type}
                            >
                                <p className='LocateUs__type'>
                                    {location.type === 'branch' ? (
                                        <FormattedMessage
                                            id='locate_us.filter.branch'
                                            defaultMessage='Branch'
                                        />
                                    ) : (
                                        <FormattedMessage
                                            id='locate_us.filter.atm'
                                            defaultMessage='ATM'
                                        />
                                    )}
                                </p>
                                <h3 className='LocateUs__name'>{location.name}</h3>
                                <p className='LocateUs__city'>{location.city}</p>
                                <p className='LocateUs__address'>{location.address}</p>
                                <p className='LocateUs__hours'>{location.hoursLabel}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
