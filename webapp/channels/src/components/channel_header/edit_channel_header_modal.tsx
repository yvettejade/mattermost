// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import type {ChangeEvent} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';

import {patchChannel} from 'mattermost-redux/actions/channels';

export const CHANNEL_HEADER_MAX_LENGTH = 1024;

type Props = {
    channel: Channel;
    onExited: () => void;
};

export default function EditChannelHeaderModal({channel, onExited}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();

    const [show, setShow] = useState(true);
    const [header, setHeader] = useState(channel.header);
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState('');

    const isTooLong = header.trim().length > CHANNEL_HEADER_MAX_LENGTH;

    const handleHide = useCallback(() => {
        setShow(false);
    }, []);

    const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
        setHeader(e.target.value);
        setServerError('');
    }, []);

    const handleSave = useCallback(async () => {
        const trimmedHeader = header.trim();

        if (trimmedHeader === channel.header.trim()) {
            setShow(false);
            return;
        }

        setSaving(true);
        const result = await dispatch(patchChannel(channel.id, {header: trimmedHeader}));
        setSaving(false);

        if (result && 'error' in result && result.error) {
            setServerError((result.error as {message?: string}).message ?? '');
            return;
        }

        setShow(false);
    }, [channel.header, channel.id, dispatch, header]);

    let errorText: string | undefined;
    if (isTooLong) {
        errorText = intl.formatMessage({
            id: 'edit_channel_header_modal.error',
            defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
        }, {maxLength: CHANNEL_HEADER_MAX_LENGTH});
    } else if (serverError) {
        errorText = serverError;
    }

    return (
        <GenericModal
            id='editChannelHeaderModal'
            className='EditChannelHeaderModal'
            show={show}
            compassDesign={true}
            modalHeaderText={intl.formatMessage({id: 'edit_channel_header_modal.title', defaultMessage: 'Edit Header for {channel}'}, {channel: channel.display_name})}
            modalSubheaderText={intl.formatMessage({id: 'edit_channel_header_modal.description', defaultMessage: 'Edit the text appearing next to the channel name in the header.'})}
            confirmButtonText={intl.formatMessage({id: 'edit_channel_header_modal.save', defaultMessage: 'Save'})}
            cancelButtonText={intl.formatMessage({id: 'edit_channel_header_modal.cancel', defaultMessage: 'Cancel'})}
            handleConfirm={handleSave}
            handleCancel={handleHide}
            onHide={handleHide}
            onExited={onExited}
            autoCloseOnConfirmButton={false}
            isConfirmDisabled={isTooLong || saving}
            errorText={errorText}
        >
            <textarea
                id='editChannelHeaderTextarea'
                className='form-control no-resize'
                rows={4}
                autoFocus={true}
                value={header}
                placeholder={intl.formatMessage({id: 'edit_channel_header_modal.placeholder', defaultMessage: 'Enter the Channel Header'})}
                aria-label={intl.formatMessage({id: 'edit_channel_header_modal.placeholder', defaultMessage: 'Enter the Channel Header'})}
                onChange={handleChange}
            />
        </GenericModal>
    );
}
