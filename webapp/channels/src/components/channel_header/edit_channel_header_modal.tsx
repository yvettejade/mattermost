// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {setShowPreviewOnEditChannelHeaderModal} from 'actions/views/textbox';
import {showPreviewOnEditChannelHeaderModal} from 'selectors/views/textbox';

import type {TextboxElement} from 'components/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';

// Matches server model.ChannelHeaderMaxRunes and the channel settings header field.
const CHANNEL_HEADER_MAX_LENGTH = 1024;

type Props = {
    channel: Channel;
    onExited?: () => void;
    onHide: () => void;
};

const EditChannelHeaderModal = ({channel, onExited, onHide}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const shouldShowPreview = useSelector(showPreviewOnEditChannelHeaderModal);

    const [header, setHeader] = useState(channel.header ?? '');
    const [serverError, setServerError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        dispatch(setShowPreviewOnEditChannelHeaderModal(false));
    }, [dispatch]);

    const trimmedHeader = header.trim();
    const exceedsLimit = trimmedHeader.length > CHANNEL_HEADER_MAX_LENGTH;

    const limitError = exceedsLimit ? formatMessage({
        id: 'edit_channel_header_modal.error',
        defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
    }, {
        maxLength: CHANNEL_HEADER_MAX_LENGTH,
    }) : undefined;

    const togglePreview = useCallback(() => {
        dispatch(setShowPreviewOnEditChannelHeaderModal(!shouldShowPreview));
    }, [dispatch, shouldShowPreview]);

    const handleHeaderChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        setHeader(e.target.value);
        setServerError('');
    }, []);

    const handleKeyPress = useCallback(() => {}, []);

    const handleSave = useCallback(async () => {
        if (saving || exceedsLimit) {
            return;
        }

        if (trimmedHeader === (channel.header ?? '').trim()) {
            onHide();
            return;
        }

        setSaving(true);
        setServerError('');

        try {
            const result = await dispatch(patchChannel(channel.id, {header: trimmedHeader}));
            if (result.error) {
                const error = result.error as ServerError;
                setServerError(error.message || formatMessage({
                    id: 'channel_settings.unknown_error',
                    defaultMessage: 'Something went wrong.',
                }));
                setSaving(false);
                return;
            }

            onHide();
        } catch {
            setServerError(formatMessage({
                id: 'channel_settings.unknown_error',
                defaultMessage: 'Something went wrong.',
            }));
            setSaving(false);
        }
    }, [channel.header, channel.id, dispatch, exceedsLimit, formatMessage, onHide, saving, trimmedHeader]);

    return (
        <GenericModal
            compassDesign={true}
            className='edit-channel-header-modal'
            modalHeaderText={formatMessage({
                id: 'edit_channel_header_modal.title',
                defaultMessage: 'Edit Header for {channel}',
            }, {
                channel: channel.display_name,
            })}
            confirmButtonText={formatMessage({
                id: 'edit_channel_header_modal.save',
                defaultMessage: 'Save',
            })}
            cancelButtonText={formatMessage({
                id: 'edit_channel_header_modal.cancel',
                defaultMessage: 'Cancel',
            })}
            handleConfirm={handleSave}
            handleCancel={onHide}
            onHide={onHide}
            onExited={onExited}
            autoCloseOnConfirmButton={false}
            isConfirmDisabled={saving || exceedsLimit}
            errorText={serverError}
            dataTestId='edit-channel-header-modal'
        >
            <AdvancedTextbox
                id='edit_channel_header_textbox'
                value={header}
                channelId={channel.id}
                onChange={handleHeaderChange}
                createMessage={formatMessage({
                    id: 'edit_channel_header_modal.placeholder',
                    defaultMessage: 'Enter the Channel Header',
                })}
                maxLength={CHANNEL_HEADER_MAX_LENGTH}
                preview={shouldShowPreview}
                togglePreview={togglePreview}
                useChannelMentions={false}
                onKeyPress={handleKeyPress}
                descriptionMessage={formatMessage({
                    id: 'edit_channel_header_modal.description',
                    defaultMessage: 'Edit the text appearing next to the channel name in the header.',
                })}
                hasError={exceedsLimit}
                errorMessage={limitError}
                showCharacterCount={exceedsLimit}
                name={formatMessage({
                    id: 'channel_settings.header.label',
                    defaultMessage: 'Channel Header',
                })}
            />
        </GenericModal>
    );
};

export default EditChannelHeaderModal;
