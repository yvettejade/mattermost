// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import type {TextboxElement} from 'components/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';

import {Constants} from 'utils/constants';

import type {PropsFromRedux} from './index';

const headerMaxLength = 1024;

export type OwnProps = {
    onExited: () => void;
    channel: Channel;
    dmUser?: UserProfile;
    canEdit: boolean;
};

export type Props = OwnProps & PropsFromRedux;

function headerCodePointLength(value: string) {
    return Array.from(value.trim()).length;
}

export function EditChannelHeaderModal({
    channel,
    dmUser,
    canEdit,
    onExited,
    shouldShowPreview,
    actions,
}: Props) {
    const {formatMessage} = useIntl();
    const isBotDM = channel.type === Constants.DM_CHANNEL && Boolean(dmUser?.is_bot);
    const displayHeader = isBotDM ? (dmUser?.bot_description ?? '') : (channel.header ?? '');
    const allowEdit = canEdit && !isBotDM;

    const [header, setHeader] = useState(displayHeader);
    const [saving, setSaving] = useState(false);
    const [show, setShow] = useState(true);
    const [serverError, setServerError] = useState<ServerError | null>(null);

    const isOverLimit = headerCodePointLength(header) > headerMaxLength;

    const hideModal = useCallback(() => {
        setShow(false);
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        const nextHeader = e.target.value;
        setHeader(nextHeader);
        if (headerCodePointLength(nextHeader) > headerMaxLength) {
            setServerError({
                server_error_id: 'model.channel.is_valid.header.app_error',
                message: 'Invalid header length',
            });
        } else {
            setServerError(null);
        }
    }, []);

    const handleSave = useCallback(async () => {
        if (!allowEdit || isOverLimit) {
            return;
        }

        const nextHeader = header.trim();
        if (nextHeader === (channel.header ?? '')) {
            hideModal();
            return;
        }

        setSaving(true);
        const {error} = await actions.patchChannel(channel.id, {header: nextHeader});
        if (error) {
            setServerError(error);
            setSaving(false);
            return;
        }

        hideModal();
    }, [allowEdit, isOverLimit, header, channel.header, channel.id, actions, hideModal]);

    const togglePreview = useCallback(() => {
        actions.setShowPreview(!shouldShowPreview);
    }, [actions, shouldShowPreview]);

    const errorMessage = useMemo(() => {
        if (!serverError) {
            return undefined;
        }

        if (serverError.server_error_id === 'model.channel.is_valid.header.app_error') {
            return formatMessage({
                id: 'edit_channel_header_modal.error',
                defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
            }, {
                maxLength: headerMaxLength,
            });
        }

        return serverError.message;
    }, [serverError, formatMessage]);

    let title = (
        <FormattedMessage
            id='channel_header.channelHeader'
            defaultMessage='Channel header'
        />
    );
    if (allowEdit && channel.type === Constants.DM_CHANNEL) {
        title = (
            <FormattedMessage
                id='edit_channel_header_modal.title_dm'
                defaultMessage='Edit Header'
            />
        );
    } else if (allowEdit) {
        title = (
            <FormattedMessage
                id='edit_channel_header_modal.title'
                defaultMessage='Edit Header for {channel}'
                values={{
                    channel: channel.display_name,
                }}
            />
        );
    }

    return (
        <Modal
            dialogClassName='a11y__modal'
            show={show}
            keyboard={true}
            onHide={hideModal}
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
            <Modal.Body
                bsClass='modal-body edit-modal-body'
            >
                <AdvancedTextbox
                    id='edit_textbox'
                    value={header}
                    channelId={channel.id}
                    onChange={handleChange}
                    onKeyPress={() => {}}
                    createMessage={formatMessage({id: 'edit_channel_header_modal.placeholder', defaultMessage: 'Enter the Channel Header'})}
                    maxLength={headerMaxLength}
                    preview={allowEdit ? shouldShowPreview : true}
                    togglePreview={togglePreview}
                    useChannelMentions={false}
                    hasError={Boolean(errorMessage)}
                    errorMessage={errorMessage}
                    showCharacterCount={isOverLimit}
                    countByCodePoints={true}
                    readOnly={!allowEdit}
                    name={formatMessage({id: 'channel_header.channelHeader', defaultMessage: 'Channel header'})}
                />
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type='button'
                    emphasis='tertiary'
                    onClick={hideModal}
                >
                    {allowEdit ? (
                        <FormattedMessage
                            id='edit_channel_header_modal.cancel'
                            defaultMessage='Cancel'
                        />
                    ) : (
                        <FormattedMessage
                            id='edit_channel_header_modal.close'
                            defaultMessage='Close'
                        />
                    )}
                </Button>
                {allowEdit && (
                    <Button
                        disabled={saving || isOverLimit}
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

export default EditChannelHeaderModal;
