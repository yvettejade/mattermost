// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import type {ActionResult} from 'mattermost-redux/types/actions';

import type {TextboxElement} from 'components/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

const HEADER_MAX_LENGTH = 1024;

type Actions = {
    patchChannel: (channelId: string, patch: Partial<Channel>) => Promise<ActionResult>;
    setShowPreviewOnEditChannelHeaderModal: (showPreview: boolean) => void;
};

export type Props = {
    channel: Channel;
    onExited: () => void;
    ctrlSend: boolean;
    canEdit: boolean;
    shouldShowPreview: boolean;
    actions: Actions;
};

export default function EditChannelHeaderModal({
    channel,
    onExited,
    ctrlSend,
    canEdit,
    shouldShowPreview,
    actions,
}: Props) {
    const {formatMessage} = useIntl();
    const [header, setHeader] = useState(channel.header ?? '');
    const [show, setShow] = useState(true);
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const isTooLong = header.trim().length > HEADER_MAX_LENGTH;
    const isEmptyHeader = (channel.header ?? '').trim().length === 0;

    const onHide = useCallback(() => {
        setShow(false);
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        setHeader(e.target.value);
        setServerError(null);
    }, []);

    const handleSave = useCallback(async () => {
        if (!canEdit || saving) {
            return;
        }

        const trimmed = header.trim();
        if (trimmed.length > HEADER_MAX_LENGTH) {
            return;
        }

        if (trimmed === (channel.header ?? '').trim()) {
            onHide();
            return;
        }

        setSaving(true);
        const {error} = await actions.patchChannel(channel.id, {header: trimmed});
        setSaving(false);

        if (error) {
            setServerError((error as ServerError).message);
            return;
        }

        onHide();
    }, [actions, canEdit, channel.header, channel.id, header, onHide, saving]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent<TextboxElement>) => {
        if (!canEdit) {
            return;
        }

        if (!Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER) || e.shiftKey || e.altKey) {
            return;
        }

        if (ctrlSend && !e.ctrlKey) {
            return;
        }

        if (!ctrlSend && e.ctrlKey) {
            return;
        }

        e.preventDefault();
        handleSave();
    }, [canEdit, ctrlSend, handleSave]);

    const togglePreview = useCallback(() => {
        actions.setShowPreviewOnEditChannelHeaderModal(!shouldShowPreview);
    }, [actions, shouldShowPreview]);

    const title = channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL ? (
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
            onExited={onExited}
            role='none'
            aria-labelledby='editChannelHeaderModalLabel'
            id='editChannelHeaderModal'
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
                    {isEmptyHeader ? (
                        <FormattedMessage
                            id='edit_channel_header_modal.empty'
                            defaultMessage='This channel has no header yet. Add text to show it next to the channel name.'
                        />
                    ) : (
                        <FormattedMessage
                            id='edit_channel_header_modal.description'
                            defaultMessage='Edit the text appearing next to the channel name in the header.'
                        />
                    )}
                </p>
                {!canEdit && (
                    <p
                        className='form-group has-error'
                        role='status'
                    >
                        <FormattedMessage
                            id='edit_channel_header_modal.read_only'
                            defaultMessage='This channel header cannot be edited.'
                        />
                    </p>
                )}
                <AdvancedTextbox
                    id='edit_textbox'
                    value={header}
                    channelId={channel.id}
                    onChange={handleChange}
                    onKeyPress={handleKeyPress}
                    createMessage={formatMessage({
                        id: 'edit_channel_header_modal.placeholder',
                        defaultMessage: 'Enter the Channel Header',
                    })}
                    maxLength={HEADER_MAX_LENGTH}
                    preview={shouldShowPreview}
                    togglePreview={togglePreview}
                    useChannelMentions={false}
                    hasError={isTooLong}
                    errorMessage={isTooLong ? formatMessage({
                        id: 'edit_channel_header_modal.error',
                        defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
                    }, {maxLength: HEADER_MAX_LENGTH}) : undefined}
                    showCharacterCount={isTooLong}
                    readOnly={!canEdit}
                />
                {serverError && (
                    <div className='form-group has-error'>
                        <br/>
                        <label className='control-label'>{serverError}</label>
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
                {canEdit && (
                    <Button
                        type='button'
                        emphasis='primary'
                        disabled={saving || isTooLong}
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
