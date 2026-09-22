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
    APPROVED_EXPORT_ITEMS,
    getExportPayloads,
    isExportConnectorEnabled,
    setExportConnectorEnabled,
} from './export_connector';

import './export_monitor.scss';

export default function ExportMonitor() {
    const dispatch = useDispatch();
    const [connectorEnabled, setConnectorEnabled] = useState(isExportConnectorEnabled);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const handleTurnConnectorOn = useCallback(() => {
        setExportConnectorEnabled(true);
        setConnectorEnabled(true);
    }, []);

    const payloads = getExportPayloads(connectorEnabled);

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
                        defaultMessage='Approved items sync to the export destination within an hour'
                    />
                }
            />
            <div className='ExportMonitor__body'>
                <section
                    className='ExportMonitor__connector'
                    aria-labelledby='export-monitor-connector-heading'
                >
                    <div className='ExportMonitor__connectorRow'>
                        <h3
                            id='export-monitor-connector-heading'
                            className='ExportMonitor__sectionTitle'
                        >
                            <FormattedMessage
                                id='export_monitor.connector.heading'
                                defaultMessage='Export connector'
                            />
                        </h3>
                        <p
                            className='ExportMonitor__status'
                            data-testid='export-connector-status'
                        >
                            {connectorEnabled ? (
                                <FormattedMessage
                                    id='export_monitor.connector.on'
                                    defaultMessage='On'
                                />
                            ) : (
                                <FormattedMessage
                                    id='export_monitor.connector.off'
                                    defaultMessage='Off'
                                />
                            )}
                        </p>
                        {!connectorEnabled && (
                            <Button
                                emphasis='primary'
                                onClick={handleTurnConnectorOn}
                            >
                                <FormattedMessage
                                    id='export_monitor.connector.turnOn'
                                    defaultMessage='Turn connector on'
                                />
                            </Button>
                        )}
                    </div>
                    <p className='ExportMonitor__note'>
                        <FormattedMessage
                            id='export_monitor.destination.note'
                            defaultMessage='Export destination settings cannot be changed from this app.'
                        />
                    </p>
                </section>

                <section aria-labelledby='export-monitor-approved-heading'>
                    <h3
                        id='export-monitor-approved-heading'
                        className='ExportMonitor__sectionTitle'
                    >
                        <FormattedMessage
                            id='export_monitor.approved.heading'
                            defaultMessage='Approved items'
                        />
                    </h3>
                    <p className='ExportMonitor__sectionHint'>
                        <FormattedMessage
                            id='export_monitor.approved.hint'
                            defaultMessage='Present in the app and audit log'
                        />
                    </p>
                    <ul className='ExportMonitor__list'>
                        {APPROVED_EXPORT_ITEMS.map((item) => (
                            <li
                                key={item.id}
                                className='ExportMonitor__item'
                            >
                                <div className='ExportMonitor__itemMain'>
                                    <p className='ExportMonitor__itemId'>{item.id}</p>
                                    <h4 className='ExportMonitor__itemTitle'>
                                        <FormattedMessage {...item.title}/>
                                    </h4>
                                </div>
                                <p className='ExportMonitor__itemMeta'>
                                    <FormattedMessage
                                        id='export_monitor.item.approved'
                                        defaultMessage='Approved'
                                    />
                                    {' · '}
                                    <FormattedDate value={item.approvedAt}/>
                                    {' '}
                                    <FormattedTime value={item.approvedAt}/>
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>

                <section aria-labelledby='export-monitor-payloads-heading'>
                    <h3
                        id='export-monitor-payloads-heading'
                        className='ExportMonitor__sectionTitle'
                    >
                        <FormattedMessage
                            id='export_monitor.payloads.heading'
                            defaultMessage='Export payloads'
                        />
                    </h3>
                    {payloads.length === 0 ? (
                        <p
                            className='ExportMonitor__empty'
                            data-testid='export-payloads-empty'
                        >
                            <FormattedMessage
                                id='export_monitor.payloads.empty'
                                defaultMessage='No payloads. The export connector is off.'
                            />
                        </p>
                    ) : (
                        <ul className='ExportMonitor__list'>
                            {payloads.map((payload) => (
                                <li
                                    key={payload.id}
                                    className='ExportMonitor__item'
                                    data-testid='export-payload'
                                >
                                    <div className='ExportMonitor__itemMain'>
                                        <p className='ExportMonitor__itemId'>{payload.itemId}</p>
                                        <h4 className='ExportMonitor__itemTitle'>
                                            <FormattedMessage {...payload.title}/>
                                        </h4>
                                    </div>
                                    <p className='ExportMonitor__itemMeta'>
                                        <FormattedMessage
                                            id='export_monitor.payload.synced'
                                            defaultMessage='Synced'
                                        />
                                        {' · '}
                                        <FormattedDate value={payload.syncedAt}/>
                                        {' '}
                                        <FormattedTime value={payload.syncedAt}/>
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
