// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
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

type Props = {
    channel: Channel;
    onExited: () => void;
};

export default function EditChannelHeaderModal({channel, onExited}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();
    const preview = useSelector(showPreviewOnEditChannelHeaderModal);
    const [header, setHeader] = useState(channel.header || '');
    const [requestError, setRequestError] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);

    useEffect(() => {
        return () => {
            dispatch(setShowPreviewOnEditChannelHeaderModal(false));
        };
    }, [dispatch]);

    let title = intl.formatMessage({
        id: 'edit_channel_header_modal.title',
        defaultMessage: 'Edit Header for {channel}',
    }, {
        channel: channel.display_name,
    });
    if (channel.type === Constants.DM_CHANNEL) {
        title = intl.formatMessage({
            id: 'edit_channel_header_modal.title_dm',
            defaultMessage: 'Edit Header',
        });
    }

    const lengthError = intl.formatMessage({
        id: 'edit_channel_header_modal.error',
        defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
    }, {
        maxLength: HEADER_MAX_LENGTH,
    });

    const save = useCallback(async () => {
        if (savingRef.current) {
            return;
        }

        const trimmed = header.trim();
        if (Array.from(trimmed).length > HEADER_MAX_LENGTH) {
            setRequestError(lengthError);
            return;
        }

        savingRef.current = true;
        setSaving(true);
        setRequestError(undefined);

        const {error} = await dispatch(patchChannel(channel.id, {header: trimmed}));
        savingRef.current = false;
        setSaving(false);

        if (error) {
            setRequestError((error as ServerError).message);
            return;
        }

        dispatch(closeModal(ModalIdentifiers.EDIT_CHANNEL_HEADER));
    }, [channel.id, dispatch, header, lengthError]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent<TextboxElement>) => {
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) {
            return;
        }

        e.preventDefault();
        save();
    }, [save]);

    const togglePreview = useCallback(() => {
        dispatch(setShowPreviewOnEditChannelHeaderModal(!preview));
    }, [dispatch, preview]);

    return (
        <GenericModal
            compassDesign={true}
            modalHeaderTextId='editChannelHeaderModalLabel'
            ariaLabelledby='editChannelHeaderModalLabel'
            modalHeaderText={title}
            ariaLabel={title}
            onExited={onExited}
            handleCancel={onExited}
            handleConfirm={save}
            autoCloseOnConfirmButton={false}
            isConfirmDisabled={saving}
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
        >
            <AdvancedTextbox
                id='edit_textbox'
                value={header}
                channelId={channel.id}
                onChange={(e) => {
                    setHeader(e.target.value);
                    setRequestError(undefined);
                }}
                onKeyPress={handleKeyPress}
                createMessage={intl.formatMessage({
                    id: 'edit_channel_header_modal.placeholder',
                    defaultMessage: 'Enter the Channel Header',
                })}
                maxLength={HEADER_MAX_LENGTH}
                preview={preview}
                togglePreview={togglePreview}
                useChannelMentions={false}
                countCodePoints={true}
                hasError={Boolean(requestError)}
                errorMessage={requestError}
            />
        </GenericModal>
    );
}
