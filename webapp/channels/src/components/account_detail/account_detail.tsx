// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import Header from 'components/widgets/header';

import ThisMonthSpendPanel from './this_month_spend_panel';
import type {AccountKind} from './types';

import './account_detail.scss';

const ACCOUNTS: Array<{kind: AccountKind; nameId: string; name: string; typeId: string; type: string}> = [
    {
        kind: 'transaction',
        nameId: 'account_detail.transaction.name',
        name: 'Everyday',
        typeId: 'account_detail.transaction.type',
        type: 'Transaction account',
    },
    {
        kind: 'credit',
        nameId: 'account_detail.credit.name',
        name: 'Credit',
        typeId: 'account_detail.credit.type',
        type: 'Credit account',
    },
];

export default function AccountDetail() {
    const {formatMessage} = useIntl();
    const [selectedKind, setSelectedKind] = useState<AccountKind>('transaction');
    const selected = ACCOUNTS.find((account) => account.kind === selectedKind) ?? ACCOUNTS[0];

    const selectAccount = useCallback((kind: AccountKind) => {
        setSelectedKind(kind);
    }, []);

    return (
        <div
            id='app-content'
            className='AccountDetail app__content'
        >
            <Header
                level={2}
                className='AccountDetail__header'
                heading={
                    <FormattedMessage
                        id='account_detail.heading'
                        defaultMessage='Account'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='account_detail.subtitle'
                        defaultMessage='This month spend by category'
                    />
                }
            />
            <div className='AccountDetail__main'>
                <div
                    className='AccountDetail__tabs'
                    role='tablist'
                    aria-label={formatMessage({id: 'account_detail.tabs', defaultMessage: 'Accounts'})}
                >
                    {ACCOUNTS.map((account) => {
                        const selectedTab = account.kind === selectedKind;
                        return (
                            <Button
                                key={account.kind}
                                type='button'
                                role='tab'
                                id={`account-tab-${account.kind}`}
                                aria-selected={selectedTab}
                                aria-controls={`account-panel-${account.kind}`}
                                emphasis={selectedTab ? 'primary' : 'tertiary'}
                                size='sm'
                                onClick={() => selectAccount(account.kind)}
                            >
                                <FormattedMessage
                                    id={account.nameId}
                                    defaultMessage={account.name}
                                />
                            </Button>
                        );
                    })}
                </div>
                <section
                    id={`account-panel-${selected.kind}`}
                    role='tabpanel'
                    aria-labelledby={`account-tab-${selected.kind}`}
                    className='AccountDetail__panel'
                >
                    <h3 className='AccountDetail__accountName'>
                        <FormattedMessage
                            id={selected.nameId}
                            defaultMessage={selected.name}
                        />
                    </h3>
                    <p className='AccountDetail__accountType'>
                        <FormattedMessage
                            id={selected.typeId}
                            defaultMessage={selected.type}
                        />
                    </p>
                    <ThisMonthSpendPanel accountKind={selected.kind}/>
                </section>
            </div>
        </div>
    );
}
