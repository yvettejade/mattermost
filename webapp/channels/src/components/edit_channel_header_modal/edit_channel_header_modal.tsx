// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {closeModal} from 'actions/views/modals';
import {setShowPreviewOnEditChannelHeaderModal} from 'actions/views/textbox';
import {showPreviewOnEditChannelHeaderModal} from 'selectors/views/textbox';

import type {TextboxElement} from 'components/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';

import Constants, {ModalIdentifiers} from 'utils/constants';

const HEADER_MAX_LENGTH = 1024;

export type Props = {
    channel: Channel;
    onExited?: () => void;
};

export default function EditChannelHeaderModal({channel, onExited}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const preview = useSelector(showPreviewOnEditChannelHeaderModal);

    const [header, setHeader] = useState(channel.header ?? '');
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState('');

    const trimmedLength = Array.from(header.trim()).length;
    const tooLong = trimmedLength > HEADER_MAX_LENGTH;

    const handleClose = useCallback(() => {
        dispatch(closeModal(ModalIdentifiers.EDIT_CHANNEL_HEADER));
    }, [dispatch]);

    const handleChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        setHeader(e.target.value);
        setServerError('');
    }, []);

    const togglePreview = useCallback(() => {
        dispatch(setShowPreviewOnEditChannelHeaderModal(!preview));
    }, [dispatch, preview]);

    const handleSave = useCallback(async () => {
        if (saving) {
            return;
        }

        const trimmed = header.trim();
        if (Array.from(trimmed).length > HEADER_MAX_LENGTH) {
            setServerError(formatMessage({
                id: 'edit_channel_header_modal.error',
                defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
            }, {
                maxLength: HEADER_MAX_LENGTH,
            }));
            return;
        }

        setSaving(true);
        const {error} = await dispatch(patchChannel(channel.id, {header: trimmed}));
        if (error) {
            setSaving(false);
            setServerError((error as ServerError).message);
            return;
        }

        handleClose();
    }, [channel.id, dispatch, formatMessage, handleClose, header, saving]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent<TextboxElement>) => {
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) {
            return;
        }

        e.preventDefault();
        handleSave();
    }, [handleSave]);

    const isDirect = channel.type === Constants.DM_CHANNEL;
    const title = isDirect ? (
        <FormattedMessage
            id='edit_channel_header_modal.title_dm'
            defaultMessage='Edit Header'
        />
    ) : (
        <FormattedMessage
            id='edit_channel_header_modal.title'
            defaultMessage='Edit Header for {channel}'
            values={{
                channel: channel.display_name,
            }}
        />
    );

    const lengthError = tooLong ? formatMessage({
        id: 'edit_channel_header_modal.error',
        defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
    }, {
        maxLength: HEADER_MAX_LENGTH,
    }) : undefined;

    return (
        <GenericModal
            compassDesign={true}
            modalHeaderText={title}
            modalHeaderTextId='editChannelHeaderModalLabel'
            ariaLabelledby='editChannelHeaderModalLabel'
            handleConfirm={handleSave}
            handleCancel={handleClose}
            onExited={onExited}
            confirmButtonText={
                <FormattedMessage
                    id='edit_channel_header_modal.save'
                    defaultMessage='Save'
                />
            }
            cancelButtonText={
                <FormattedMessage
                    id='edit_channel_header_modal.cancel'
                    defaultMessage='Cancel'
                />
            }
            isConfirmDisabled={saving}
            autoCloseOnConfirmButton={false}
            errorText={serverError || undefined}
        >
            <AdvancedTextbox
                id='edit_textbox'
                channelId={channel.id}
                value={header}
                onChange={handleChange}
                onKeyPress={handleKeyPress}
                createMessage={formatMessage({
                    id: 'edit_channel_header_modal.placeholder',
                    defaultMessage: 'Enter the Channel Header',
                })}
                maxLength={HEADER_MAX_LENGTH}
                countCodePoints={true}
                preview={preview}
                togglePreview={togglePreview}
                useChannelMentions={false}
                hasError={tooLong}
                errorMessage={lengthError}
                showCharacterCount={tooLong}
            />
        </GenericModal>
    );
}
