// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {KeyboardEvent} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import type {TextboxElement} from 'components/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import * as Utils from 'utils/utils';

const HEADER_MAX_RUNES = 1024;

type Actions = {
    patchChannel: (channelId: string, patch: Partial<Channel>) => Promise<ActionResult>;
    setShowPreviewOnEditChannelHeaderModal: (showPreview: boolean) => void;
}

type Props = {
    channel: Channel;
    onExited: () => void;
    showPreview: boolean;
    actions: Actions;
    intl: IntlShape;
}

type State = {
    header: string;
    show: boolean;
    isSaving: boolean;
    clientError: string;
    serverError: string;
}

export class EditChannelHeaderModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            header: props.channel.header || '',
            show: true,
            isSaving: false,
            clientError: '',
            serverError: '',
        };
    }

    handleEntering = () => {
        const textbox = document.getElementById('edit_textbox') as TextboxElement | null;
        if (textbox) {
            Utils.placeCaretAtEnd(textbox);
            textbox.focus();
        }
    };

    onHide = () => {
        this.setState({show: false});
    };

    togglePreview = () => {
        this.props.actions.setShowPreviewOnEditChannelHeaderModal(!this.props.showPreview);
    };

    handleChange = (e: React.ChangeEvent<TextboxElement>) => {
        const newValue = e.target.value;
        const runeCount = Array.from(newValue.trim()).length;
        const {formatMessage} = this.props.intl;

        this.setState({
            header: newValue,
            serverError: '',
            clientError: runeCount > HEADER_MAX_RUNES ? formatMessage({
                id: 'edit_channel_header_modal.error',
                defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
            }, {
                maxLength: HEADER_MAX_RUNES,
            }) : '',
        });
    };

    handleKeyPress = (e: KeyboardEvent<TextboxElement>) => {
        if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER) && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            this.handleSave();
        }
    };

    handleSave = async () => {
        const {channel, actions: {patchChannel}} = this.props;
        const trimmed = this.state.header.trim();
        const runeCount = Array.from(trimmed).length;
        const {formatMessage} = this.props.intl;

        if (runeCount > HEADER_MAX_RUNES) {
            this.setState({
                clientError: formatMessage({
                    id: 'edit_channel_header_modal.error',
                    defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
                }, {
                    maxLength: HEADER_MAX_RUNES,
                }),
            });
            return;
        }

        if (trimmed === (channel.header || '').trim()) {
            this.onHide();
            return;
        }

        this.setState({isSaving: true, serverError: ''});

        const {data, error} = await patchChannel(channel.id, {header: trimmed});

        this.setState({isSaving: false});

        if (error) {
            this.setState({serverError: error.message});
            return;
        }

        if (data) {
            this.onHide();
        }
    };

    renderTitle = () => {
        const {channel} = this.props;
        if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
            return (
                <FormattedMessage
                    id='edit_channel_header_modal.title_dm'
                    defaultMessage='Edit Header'
                />
            );
        }

        return (
            <FormattedMessage
                id='edit_channel_header_modal.title'
                defaultMessage='Edit Header for {channel}'
                values={{channel: channel.display_name}}
            />
        );
    };

    render() {
        const {formatMessage} = this.props.intl;
        const {header, clientError, serverError} = this.state;
        const trimmedLength = Array.from(header.trim()).length;
        const hasError = Boolean(clientError) || trimmedLength > HEADER_MAX_RUNES;
        const errorMessage = clientError || serverError;

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onHide={this.onHide}
                onEntering={this.handleEntering}
                onExited={this.props.onExited}
                role='dialog'
                aria-labelledby='editChannelHeaderModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='editChannelHeaderModalLabel'
                    >
                        {this.renderTitle()}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <AdvancedTextbox
                        id='edit_textbox'
                        value={header}
                        channelId={this.props.channel.id}
                        onChange={this.handleChange}
                        onKeyPress={this.handleKeyPress}
                        createMessage={formatMessage({
                            id: 'edit_channel_header_modal.placeholder',
                            defaultMessage: 'Enter the Channel Header',
                        })}
                        maxLength={HEADER_MAX_RUNES}
                        preview={this.props.showPreview}
                        togglePreview={this.togglePreview}
                        useChannelMentions={true}
                        descriptionMessage={formatMessage({
                            id: 'edit_channel_header_modal.description',
                            defaultMessage: 'Edit the text appearing next to the channel name in the header.',
                        })}
                        hasError={hasError}
                        errorMessage={errorMessage}
                        showCharacterCount={hasError}
                        countByCodePoints={true}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        type='button'
                        emphasis='tertiary'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='edit_channel_header_modal.cancel'
                            defaultMessage='Cancel'
                        />
                    </Button>
                    <Button
                        type='button'
                        emphasis='primary'
                        disabled={this.state.isSaving || hasError}
                        onClick={this.handleSave}
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
}

export default injectIntl(EditChannelHeaderModal);
