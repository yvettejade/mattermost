// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import * as Utils from 'utils/utils';

const headerMaxLength = 1024;

type Actions = {
    patchChannel: (channelId: string, patch: Partial<Channel>) => Promise<ActionResult>;
}

type ServerError = {
    message: string;
}

type Props = {
    onExited: () => void;
    channel?: Channel;
    ctrlSend: boolean;
    actions: Actions;
    intl: IntlShape;
}

type State = {
    header: string;
    serverError: ServerError | null;
    show: boolean;
    requestStarted: boolean;
}

export class EditChannelHeaderModal extends React.PureComponent<Props, State> {
    private header: React.RefObject<HTMLTextAreaElement>;

    constructor(props: Props) {
        super(props);
        this.header = React.createRef();

        this.state = {
            header: props.channel?.header || '',
            serverError: null,
            show: true,
            requestStarted: false,
        };
    }

    handleEntering = () => {
        if (this.header.current) {
            Utils.placeCaretAtEnd(this.header.current);
        }
    };

    onHide = () => {
        this.setState({show: false});
    };

    handleKeyDown = (e: React.KeyboardEvent) => {
        const {ctrlSend} = this.props;

        if (Utils.isUnhandledLineBreakKeyCombo(e)) {
            e.preventDefault();
            this.setState({header: Utils.insertLineBreakFromKeyEvent(e.nativeEvent)});
        } else if (ctrlSend && Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER) && e.ctrlKey) {
            e.preventDefault();
            this.handleSave();
        } else if (!ctrlSend && Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER) && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            this.handleSave();
        }
    };

    handleSave = async () => {
        const {channel, actions: {patchChannel}, intl} = this.props;
        const {header} = this.state;
        if (!channel) {
            return;
        }

        if (header.length > headerMaxLength) {
            this.setState({
                serverError: {
                    message: intl.formatMessage(
                        {id: 'edit_channel_header_modal.error', defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.'},
                        {maxLength: headerMaxLength},
                    ),
                },
            });
            return;
        }

        this.setState({requestStarted: true});

        const {data, error} = await patchChannel(channel.id, {header});

        this.setState({
            serverError: error,
            requestStarted: false,
        });

        if (data) {
            this.onHide();
        }
    };

    handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        this.setState({header: e.target.value, serverError: null});
    };

    render() {
        let serverError = null;
        const {formatMessage} = this.props.intl;
        const isDM = this.props.channel?.type === Constants.DM_CHANNEL;

        if (this.state.serverError) {
            serverError = (
                <div className='form-group has-error'>
                    <br/>
                    <label className='control-label'>{this.state.serverError.message}</label>
                </div>
            );
        }

        const title = isDM ? (
            <FormattedMessage
                id='edit_channel_header_modal.title_dm'
                defaultMessage='Edit Header'
            />
        ) : (
            <FormattedMessage
                id='edit_channel_header_modal.title'
                defaultMessage='Edit Header for {channel}'
                values={{channel: this.props.channel?.display_name}}
            />
        );

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onHide={this.onHide}
                onEntering={this.handleEntering}
                onExited={this.props.onExited}
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
                <Modal.Body>
                    <p>
                        <FormattedMessage
                            id='edit_channel_header_modal.description'
                            defaultMessage='Edit the text appearing next to the channel name in the header.'
                        />
                    </p>
                    <textarea
                        ref={this.header}
                        className='form-control no-resize'
                        rows={6}
                        maxLength={headerMaxLength}
                        value={this.state.header}
                        onKeyDown={this.handleKeyDown}
                        onChange={this.handleChange}
                        placeholder={formatMessage({id: 'edit_channel_header_modal.placeholder', defaultMessage: 'Enter the Channel Header'})}
                        aria-label={formatMessage({id: 'edit_channel_header_modal.title_dm', defaultMessage: 'Edit Header'})}
                    />
                    {serverError}
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
                        disabled={this.state.requestStarted}
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
