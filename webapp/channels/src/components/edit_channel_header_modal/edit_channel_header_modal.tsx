// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {setShowPreviewOnEditChannelHeaderModal} from 'actions/views/textbox';
import {showPreviewOnEditChannelHeaderModal} from 'selectors/views/textbox';

import type {TextboxElement} from 'components/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';

import Constants from 'utils/constants';

const HEADER_MAX_LENGTH = 1024;

function codePointLength(value: string) {
    return Array.from(value).length;
}

export type Props = {
    channel: Channel;
    dmUser?: UserProfile;
    canEdit?: boolean;
    onExited: () => void;
};

export default function EditChannelHeaderModal({
    channel,
    dmUser,
    canEdit = false,
    onExited,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const shouldShowPreview = useSelector(showPreviewOnEditChannelHeaderModal);

    const isBotDM = channel.type === Constants.DM_CHANNEL && Boolean(dmUser?.is_bot);
    const sourceHeader = isBotDM ? (dmUser?.bot_description ?? '') : (channel.header ?? '');
    const allowEdit = canEdit && !isBotDM;

    const [header, setHeader] = useState(sourceHeader);
    const [saving, setSaving] = useState(false);
    const [show, setShow] = useState(true);
    const [serverError, setServerError] = useState<ServerError | null>(null);

    const isTooLong = codePointLength(header.trim()) > HEADER_MAX_LENGTH;

    const hideModal = useCallback(() => {
        setShow(false);
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        setHeader(e.target.value);
        setServerError(null);
    }, []);

    const togglePreview = useCallback(() => {
        dispatch(setShowPreviewOnEditChannelHeaderModal(!shouldShowPreview));
    }, [dispatch, shouldShowPreview]);

    const handleSave = useCallback(async () => {
        if (!allowEdit || saving || isTooLong) {
            return;
        }

        const trimmed = header.trim();
        if (trimmed === (channel.header ?? '')) {
            hideModal();
            return;
        }

        setSaving(true);
        const {error} = await dispatch(patchChannel(channel.id, {header: trimmed}));
        if (error) {
            setServerError(error as ServerError);
            setSaving(false);
            return;
        }

        hideModal();
    }, [allowEdit, saving, isTooLong, header, channel.header, channel.id, dispatch, hideModal]);

    let headerTitle: React.ReactNode;
    if (!allowEdit) {
        headerTitle = (
            <FormattedMessage
                id='channel_header.channelHeader'
                defaultMessage='Channel header'
            />
        );
    } else if (channel.type === Constants.DM_CHANNEL) {
        headerTitle = (
            <FormattedMessage
                id='edit_channel_header_modal.title_dm'
                defaultMessage='Edit Header'
            />
        );
    } else {
        headerTitle = (
            <FormattedMessage
                id='edit_channel_header_modal.title'
                defaultMessage='Edit Header for {channel}'
                values={{
                    channel: channel.display_name,
                }}
            />
        );
    }

    let errorMessage: React.ReactNode;
    if (isTooLong || serverError?.server_error_id === 'model.channel.is_valid.header.app_error') {
        errorMessage = formatMessage({
            id: 'edit_channel_header_modal.error',
            defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
        }, {
            maxLength: HEADER_MAX_LENGTH,
        });
    } else if (serverError) {
        errorMessage = serverError.message;
    }

    return (
        <GenericModal
            id='editChannelHeaderModal'
            compassDesign={true}
            show={show}
            onExited={onExited}
            modalHeaderText={headerTitle}
            modalHeaderTextId='editChannelHeaderModalLabel'
            ariaLabelledby='editChannelHeaderModalLabel'
            handleCancel={hideModal}
            handleConfirm={allowEdit ? handleSave : undefined}
            handleEnterKeyPress={allowEdit ? handleSave : undefined}
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
            isConfirmDisabled={saving || isTooLong}
            autoCloseOnConfirmButton={false}
            keyboardEscape={true}
            errorText={!isTooLong && serverError ? errorMessage : undefined}
        >
            <AdvancedTextbox
                id='edit_channel_header_textbox'
                value={header}
                channelId={channel.id}
                onChange={handleChange}
                onKeyPress={() => {}}
                createMessage={formatMessage({
                    id: 'edit_channel_header_modal.placeholder',
                    defaultMessage: 'Enter the Channel Header',
                })}
                maxLength={HEADER_MAX_LENGTH}
                preview={shouldShowPreview}
                togglePreview={togglePreview}
                useChannelMentions={false}
                showCharacterCount={isTooLong}
                countByCodePoints={true}
                readOnly={!allowEdit}
                hasError={isTooLong}
                errorMessage={isTooLong ? errorMessage : undefined}
                name={formatMessage({
                    id: 'channel_header.channelHeader',
                    defaultMessage: 'Channel header',
                })}
            />
        </GenericModal>
    );
}
