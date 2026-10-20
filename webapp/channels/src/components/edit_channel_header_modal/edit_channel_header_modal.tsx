// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import type {ChangeEvent, KeyboardEvent} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import * as Utils from 'utils/utils';

export const HEADER_MAX_LENGTH = 1024;

type Actions = {
    patchChannel: (channelId: string, patch: Partial<Channel>) => Promise<ActionResult>;
}

type ServerError = {
    message: string;
}

export type Props = {
    onExited: () => void;
    channel: Channel;
    ctrlSend: boolean;
    actions: Actions;
}

export default function EditChannelHeaderModal({channel, ctrlSend, onExited, actions}: Props) {
    const {formatMessage} = useIntl();
    const headerRef = useRef<HTMLTextAreaElement>(null);
    const [header, setHeader] = useState(channel.header || '');
    const [serverError, setServerError] = useState<ServerError | null>(null);
    const [show, setShow] = useState(true);
    const [requestStarted, setRequestStarted] = useState(false);

    const handleEntering = () => {
        if (headerRef.current) {
            Utils.placeCaretAtEnd(headerRef.current);
        }
    };

    const onHide = () => {
        setShow(false);
    };

    const handleSave = async () => {
        if (header.trim().length > HEADER_MAX_LENGTH) {
            setServerError({
                message: formatMessage({
                    id: 'edit_channel_header_modal.error',
                    defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
                }, {maxLength: HEADER_MAX_LENGTH}),
            });
            return;
        }

        setRequestStarted(true);

        const {data, error} = await actions.patchChannel(channel.id, {header});

        setServerError(error || null);
        setRequestStarted(false);

        if (data) {
            onHide();
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (Utils.isUnhandledLineBreakKeyCombo(e)) {
            e.preventDefault();
            setHeader(Utils.insertLineBreakFromKeyEvent(e.nativeEvent));
        } else if (ctrlSend && Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER) && e.ctrlKey) {
            e.preventDefault();
            handleSave();
        } else if (!ctrlSend && Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER) && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            handleSave();
        }
    };

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setHeader(e.target.value);
        if (serverError) {
            setServerError(null);
        }
    };

    const isDirectOrGroup = channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL;
    const title = isDirectOrGroup ? (
        <FormattedMessage
            id='edit_channel_header_modal.title_dm'
            defaultMessage='Edit Header'
        />
    ) : (
        <FormattedMessage
            id='edit_channel_header_modal.title'
            defaultMessage='Edit Header for {channel}'
            values={{channel: channel.display_name}}
        />
    );

    return (
        <Modal
            dialogClassName='a11y__modal'
            show={show}
            onHide={onHide}
            onEntering={handleEntering}
            onExited={onExited}
            role='none'
            aria-labelledby='editChannelHeaderModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='editChannelHeaderModalLabel'
                >
                    {title}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>
                    <FormattedMessage
                        id='edit_channel_header_modal.description'
                        defaultMessage='Edit the text appearing next to the channel name in the header.'
                    />
                </p>
                <textarea
                    ref={headerRef}
                    id='edit_textbox'
                    className='form-control no-resize'
                    rows={6}
                    maxLength={HEADER_MAX_LENGTH}
                    value={header}
                    onKeyDown={handleKeyDown}
                    onChange={handleChange}
                    placeholder={formatMessage({
                        id: 'edit_channel_header_modal.placeholder',
                        defaultMessage: 'Enter the Channel Header',
                    })}
                    aria-label={formatMessage({
                        id: 'edit_channel_header_modal.title_dm',
                        defaultMessage: 'Edit Header',
                    }).toLowerCase()}
                />
                {serverError && (
                    <div className='form-group has-error'>
                        <br/>
                        <label className='control-label'>{serverError.message}</label>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type='button'
                    emphasis='tertiary'
                    onClick={onHide}
                >
                    <FormattedMessage
                        id='edit_channel_header_modal.cancel'
                        defaultMessage='Cancel'
                    />
                </Button>
                <Button
                    type='button'
                    emphasis='primary'
                    disabled={requestStarted}
                    onClick={handleSave}
                >
                    <FormattedMessage
                        id='edit_channel_header_modal.save'
                        defaultMessage='Save'
                    />
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
