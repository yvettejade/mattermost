// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import {
    ACCOUNT_COLOURS,
    openYouMoneyAccount,
    type AccountColour,
    type EverydayAccount,
    type OpenAccountError,
} from './accounts';

const COLOUR_LABELS: Record<AccountColour, {id: string; defaultMessage: string}> = {
    navy: {id: 'online.open.colour.navy', defaultMessage: 'Navy'},
    green: {id: 'online.open.colour.green', defaultMessage: 'Green'},
    amber: {id: 'online.open.colour.amber', defaultMessage: 'Amber'},
    red: {id: 'online.open.colour.red', defaultMessage: 'Red'},
    teal: {id: 'online.open.colour.teal', defaultMessage: 'Teal'},
};

type Props = {
    onCancel: () => void;
    onOpened: (accounts: EverydayAccount[]) => void;
};

export default function OpenAccount({onCancel, onOpened}: Props) {
    const {formatMessage} = useIntl();
    const [nickname, setNickname] = useState('');
    const [colour, setColour] = useState<AccountColour | ''>('');
    const [error, setError] = useState<OpenAccountError | null>(null);

    const handleConfirm = useCallback((event: React.FormEvent) => {
        event.preventDefault();
        const result = openYouMoneyAccount({
            nickname,
            colour: colour || undefined,
        });
        if (!result.ok) {
            setError(result.error);
            return;
        }
        onOpened(result.accounts);
    }, [colour, nickname, onOpened]);

    return (
        <form
            className='Online__openForm'
            onSubmit={handleConfirm}
        >
            <h3 className='Online__sectionTitle'>
                <FormattedMessage
                    id='online.open.heading'
                    defaultMessage='Open a YouMoney account'
                />
            </h3>
            <p className='Online__openHelp'>
                <FormattedMessage
                    id='online.open.help'
                    defaultMessage='Choose a nickname and an optional colour. The new account starts at $0.00.'
                />
            </p>
            <div className='Online__field'>
                <label
                    className='Online__label'
                    htmlFor='online-open-nickname'
                >
                    <FormattedMessage
                        id='online.open.nickname'
                        defaultMessage='Nickname'
                    />
                </label>
                <input
                    id='online-open-nickname'
                    className='form-control'
                    value={nickname}
                    maxLength={40}
                    aria-invalid={error === 'nickname_required'}
                    aria-describedby={error === 'nickname_required' ? 'online-open-nickname-error' : undefined}
                    onChange={(event) => {
                        setNickname(event.target.value);
                        if (error === 'nickname_required') {
                            setError(null);
                        }
                    }}
                />
                {error === 'nickname_required' && (
                    <p
                        id='online-open-nickname-error'
                        className='Online__error'
                        role='alert'
                    >
                        <FormattedMessage
                            id='online.open.nickname.required'
                            defaultMessage='Enter a nickname to open the account.'
                        />
                    </p>
                )}
            </div>
            <fieldset
                className='Online__field'
                aria-labelledby='online-open-colour-legend'
            >
                <legend
                    id='online-open-colour-legend'
                    className='Online__label'
                >
                    <FormattedMessage
                        id='online.open.colour'
                        defaultMessage='Colour (optional)'
                    />
                </legend>
                <div
                    className='Online__colours'
                    role='radiogroup'
                    aria-label={formatMessage({
                        id: 'online.open.colour.group',
                        defaultMessage: 'Account colour',
                    })}
                >
                    <label className='Online__colourOption'>
                        <input
                            type='radio'
                            name='online-account-colour'
                            value=''
                            checked={colour === ''}
                            onChange={() => setColour('')}
                        />
                        <FormattedMessage
                            id='online.open.colour.none'
                            defaultMessage='None'
                        />
                    </label>
                    {ACCOUNT_COLOURS.map((option) => (
                        <label
                            key={option}
                            className='Online__colourOption'
                        >
                            <input
                                type='radio'
                                name='online-account-colour'
                                value={option}
                                checked={colour === option}
                                onChange={() => setColour(option)}
                            />
                            <span
                                className={`Online__swatch ${option}`}
                                aria-hidden={true}
                            />
                            <FormattedMessage {...COLOUR_LABELS[option]}/>
                        </label>
                    ))}
                </div>
            </fieldset>
            {error === 'cap' && (
                <p
                    className='Online__error'
                    role='alert'
                >
                    <FormattedMessage
                        id='online.open.cap'
                        defaultMessage='You can have up to 25 YouMoney accounts.'
                    />
                </p>
            )}
            <div className='Online__actions'>
                <Button
                    type='button'
                    emphasis='tertiary'
                    onClick={onCancel}
                >
                    <FormattedMessage
                        id='online.open.cancel'
                        defaultMessage='Cancel'
                    />
                </Button>
                <Button type='submit'>
                    <FormattedMessage
                        id='online.open.confirm'
                        defaultMessage='Confirm'
                    />
                </Button>
            </div>
        </form>
    );
}
