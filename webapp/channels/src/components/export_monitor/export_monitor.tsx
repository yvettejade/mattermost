// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedDate, FormattedMessage, FormattedTime} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {
    getExportPayloads,
    isExportConnectorEnabled,
    setExportConnectorEnabled,
} from './export_connector';

import './export_monitor.scss';

export default function ExportMonitor() {
    const dispatch = useDispatch();
    const [connectorEnabled, setConnectorEnabled] = useState(isExportConnectorEnabled);
    const payloads = connectorEnabled ? getExportPayloads() : [];

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const handleToggleConnector = useCallback(() => {
        const nextEnabled = !connectorEnabled;
        setExportConnectorEnabled(nextEnabled);
        setConnectorEnabled(nextEnabled);
    }, [connectorEnabled]);

    return (
        <div
            id='app-content'
            className='ExportMonitor app__content'
        >
            <Header
                level={2}
                className='ExportMonitor__header'
                heading={
                    <FormattedMessage
                        id='export_monitor.heading'
                        defaultMessage='Export monitor'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='export_monitor.subtitle'
                        defaultMessage='Payloads for sent drafts that sync to the export connector'
                    />
                }
                right={
                    <div className='ExportMonitor__headerActions'>
                        <span
                            className='ExportMonitor__status'
                            data-testid='export-monitor-status'
                        >
                            {connectorEnabled ? (
                                <FormattedMessage
                                    id='export_monitor.connector_on'
                                    defaultMessage='Export connector is on'
                                />
                            ) : (
                                <FormattedMessage
                                    id='export_monitor.connector_off'
                                    defaultMessage='Export connector is off'
                                />
                            )}
                        </span>
                        <Button
                            emphasis={connectorEnabled ? 'tertiary' : 'primary'}
                            onClick={handleToggleConnector}
                        >
                            {connectorEnabled ? (
                                <FormattedMessage
                                    id='export_monitor.turn_off'
                                    defaultMessage='Turn off'
                                />
                            ) : (
                                <FormattedMessage
                                    id='export_monitor.turn_on'
                                    defaultMessage='Turn on'
                                />
                            )}
                        </Button>
                    </div>
                }
            />
            {payloads.length === 0 ? (
                <p
                    className='ExportMonitor__empty'
                    data-testid='export-monitor-empty'
                >
                    <FormattedMessage
                        id='export_monitor.empty'
                        defaultMessage='No payloads. Turn the export connector on to sync sent drafts.'
                    />
                </p>
            ) : (
                <ul
                    className='ExportMonitor__list'
                    data-testid='export-monitor-payloads'
                >
                    {payloads.map((payload) => (
                        <li
                            key={payload.id}
                            className='ExportMonitor__item'
                        >
                            <h3 className='ExportMonitor__itemTitle'>
                                {payload.channelName}
                            </h3>
                            <p className='ExportMonitor__itemBody'>
                                {payload.messagePreview}
                            </p>
                            <p className='ExportMonitor__itemMeta'>
                                <FormattedDate
                                    value={new Date(payload.exportedAt)}
                                    year='numeric'
                                    month='short'
                                    day='numeric'
                                />
                                {' '}
                                <FormattedTime
                                    value={new Date(payload.exportedAt)}
                                    hour='numeric'
                                    minute='2-digit'
                                />
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
