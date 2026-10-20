// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {closeModal} from 'actions/views/modals';
import {setShowPreviewOnEditChannelHeaderModal} from 'actions/views/textbox';
import {showPreviewOnEditChannelHeaderModal} from 'selectors/views/textbox';

import type {TextboxElement} from 'components/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';

import {isArchivedChannel} from 'utils/channel_utils';
import Constants, {ModalIdentifiers} from 'utils/constants';

const HEADER_MAX_LENGTH = 1024;
const HEADER_TOO_LONG_ERROR_ID = 'model.channel.is_valid.header.app_error';

export type Props = {
    channel: Channel;
    dmUser?: UserProfile;
    canEdit: boolean;
};

function isBotDM(channel: Channel, dmUser?: UserProfile) {
    return channel.type === Constants.DM_CHANNEL && Boolean(dmUser?.is_bot);
}

const EditChannelHeaderModal = ({channel, dmUser, canEdit}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const preview = useSelector(showPreviewOnEditChannelHeaderModal);

    const botDM = isBotDM(channel, dmUser);
    const editable = canEdit && !isArchivedChannel(channel) && !botDM;
    const [header, setHeader] = useState(channel.header ?? '');
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState('');

    const value = botDM ? (dmUser?.bot_description ?? '') : header;
    const tooLong = editable && Array.from(value.trim()).length > HEADER_MAX_LENGTH;

    const restoreFocus = useCallback(() => {
        document.getElementById('channelHeaderHeaderButton')?.focus();
    }, []);

    useEffect(() => {
        return restoreFocus;
    }, [restoreFocus]);

    const close = useCallback(() => {
        dispatch(closeModal(ModalIdentifiers.EDIT_CHANNEL_HEADER));
    }, [dispatch]);

    const togglePreview = useCallback(() => {
        dispatch(setShowPreviewOnEditChannelHeaderModal(!preview));
    }, [dispatch, preview]);

    const handleChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        setHeader(e.target.value);
        setServerError('');
    }, []);

    const handleSave = useCallback(async () => {
        if (!editable || tooLong) {
            return;
        }

        const trimmed = header.trim();
        if (trimmed === (channel.header ?? '')) {
            close();
            return;
        }

        setSaving(true);
        const {error} = await dispatch(patchChannel(channel.id, {header: trimmed}));
        if (error) {
            setSaving(false);
            const serverErr = error as ServerError;
            if (serverErr.server_error_id === HEADER_TOO_LONG_ERROR_ID) {
                setServerError(formatMessage({
                    id: 'edit_channel_header_modal.error',
                    defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
                }, {
                    maxLength: HEADER_MAX_LENGTH,
                }));
            } else {
                setServerError(serverErr.message);
            }
            return;
        }

        close();
    }, [channel.header, channel.id, close, dispatch, editable, formatMessage, header, tooLong]);

    let title;
    if (!editable) {
        title = formatMessage({id: 'channel_header.channelHeader', defaultMessage: 'Channel header'});
    } else if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
        title = formatMessage({id: 'edit_channel_header_modal.title_dm', defaultMessage: 'Edit Header'});
    } else {
        title = formatMessage({
            id: 'edit_channel_header_modal.title',
            defaultMessage: 'Edit Header for {channel}',
        }, {
            channel: channel.display_name,
        });
    }

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
            ariaLabel={formatMessage({id: 'channel_header.channelHeader', defaultMessage: 'Channel header'})}
            handleConfirm={editable ? handleSave : undefined}
            handleCancel={close}
            onHide={close}
            onExited={restoreFocus}
            confirmButtonText={formatMessage({id: 'edit_channel_header_modal.save', defaultMessage: 'Save'})}
            cancelButtonText={formatMessage({id: 'edit_channel_header_modal.cancel', defaultMessage: 'Cancel'})}
            isConfirmDisabled={tooLong || saving}
            autoCloseOnConfirmButton={false}
            autoCloseOnCancelButton={false}
            errorText={serverError || undefined}
            dataTestId='editChannelHeaderModal'
        >
            <AdvancedTextbox
                id='edit_channel_header_textbox'
                channelId={channel.id}
                value={value}
                onChange={handleChange}
                onKeyPress={() => {}}
                createMessage={formatMessage({
                    id: 'edit_channel_header_modal.placeholder',
                    defaultMessage: 'Enter the Channel Header',
                })}
                maxLength={HEADER_MAX_LENGTH}
                countCodePoints={true}
                preview={preview}
                togglePreview={togglePreview}
                useChannelMentions={true}
                descriptionMessage={editable ? formatMessage({
                    id: 'edit_channel_header_modal.description',
                    defaultMessage: 'Edit the text appearing next to the channel name in the header.',
                }) : undefined}
                hasError={tooLong}
                errorMessage={lengthError}
                showCharacterCount={tooLong}
                readOnly={!editable}
            />
        </GenericModal>
    );
};

export default EditChannelHeaderModal;
