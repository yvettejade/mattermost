// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {setShowPreviewOnEditChannelHeaderModal} from 'actions/views/textbox';
import {showPreviewOnEditChannelHeaderModal} from 'selectors/views/textbox';

import type {TextboxElement} from 'components/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

const headerMaxLength = 1024;

export type Props = {
    onExited: () => void;
    channel: Channel;
    dmUser?: UserProfile;
    canEdit: boolean;
};

function isBotDM(channel: Channel, dmUser?: UserProfile) {
    return channel.type === Constants.DM_CHANNEL && Boolean(dmUser?.is_bot);
}

function initialHeader(channel: Channel, dmUser?: UserProfile) {
    if (isBotDM(channel, dmUser)) {
        return dmUser?.bot_description ?? '';
    }
    return channel.header ?? '';
}

function headerCodePointLength(value: string) {
    return Array.from(value.trim()).length;
}

export default function EditChannelHeaderModal({onExited, channel, dmUser, canEdit}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const shouldShowPreview = useSelector((state: GlobalState) => showPreviewOnEditChannelHeaderModal(state));

    const botDM = isBotDM(channel, dmUser);
    const editingAllowed = canEdit && !botDM;

    const [header, setHeader] = useState(() => initialHeader(channel, dmUser));
    const [saving, setSaving] = useState(false);
    const [show, setShow] = useState(true);
    const [serverError, setServerError] = useState<ServerError | null>(null);

    const tooLong = headerCodePointLength(header) > headerMaxLength;

    const lengthError = useMemo(() => {
        if (!tooLong) {
            return undefined;
        }
        return formatMessage(
            {
                id: 'edit_channel_header_modal.error',
                defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
            },
            {maxLength: headerMaxLength},
        );
    }, [formatMessage, tooLong]);

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
        if (!editingAllowed || tooLong) {
            return;
        }

        const nextHeader = header.trim();
        if (nextHeader === (channel.header ?? '')) {
            hideModal();
            return;
        }

        setSaving(true);
        const {error} = await dispatch(patchChannel(channel.id, {header: nextHeader}));
        if (error) {
            setServerError(error as ServerError);
            setSaving(false);
            return;
        }

        hideModal();
    }, [channel.header, channel.id, dispatch, editingAllowed, header, hideModal, tooLong]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent<TextboxElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleSave();
        }
    }, [handleSave]);

    let headerTitle = (
        <FormattedMessage
            id='edit_channel_header_modal.title'
            defaultMessage='Edit Header for {channel}'
            values={{
                channel: channel.display_name,
            }}
        />
    );
    if (channel.type === Constants.DM_CHANNEL) {
        headerTitle = (
            <FormattedMessage
                id='edit_channel_header_modal.title_dm'
                defaultMessage='Edit Header'
            />
        );
    }
    if (!editingAllowed) {
        headerTitle = (
            <FormattedMessage
                id='channel_header.channelHeader'
                defaultMessage='Channel header'
            />
        );
    }

    let errorContent: React.ReactNode = lengthError;
    if (!lengthError && serverError) {
        if (serverError.server_error_id === 'model.channel.is_valid.header.app_error') {
            errorContent = formatMessage(
                {
                    id: 'edit_channel_header_modal.error',
                    defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
                },
                {maxLength: headerMaxLength},
            );
        } else {
            errorContent = serverError.message;
        }
    }

    return (
        <Modal
            dialogClassName='a11y__modal'
            show={show}
            onHide={hideModal}
            onExited={onExited}
            restoreFocus={true}
            role='none'
            aria-labelledby='editChannelHeaderModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='editChannelHeaderModalLabel'
                >
                    {headerTitle}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body bsClass='modal-body edit-modal-body'>
                <AdvancedTextbox
                    id='edit_channel_header_textbox'
                    value={header}
                    channelId={channel.id}
                    onChange={handleChange}
                    onKeyPress={handleKeyPress}
                    createMessage={formatMessage({id: 'edit_channel_header_modal.placeholder', defaultMessage: 'Enter the Channel Header'})}
                    maxLength={headerMaxLength}
                    preview={shouldShowPreview}
                    togglePreview={togglePreview}
                    useChannelMentions={true}
                    hasError={Boolean(errorContent)}
                    errorMessage={errorContent}
                    showCharacterCount={tooLong}
                    countByCodePoints={true}
                    readOnly={!editingAllowed}
                    name={formatMessage({id: 'channel_header.channelHeader', defaultMessage: 'Channel header'})}
                />
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type='button'
                    emphasis='tertiary'
                    onClick={hideModal}
                >
                    <FormattedMessage
                        id='edit_channel_header_modal.cancel'
                        defaultMessage='Cancel'
                    />
                </Button>
                {editingAllowed && (
                    <Button
                        disabled={saving || tooLong}
                        type='button'
                        emphasis='primary'
                        onClick={handleSave}
                    >
                        <FormattedMessage
                            id='edit_channel_header_modal.save'
                            defaultMessage='Save'
                        />
                    </Button>
                )}
            </Modal.Footer>
        </Modal>
    );
}
