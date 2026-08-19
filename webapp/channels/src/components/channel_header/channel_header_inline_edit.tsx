// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Channel} from '@mattermost/types/channels';

import {patchChannel} from 'mattermost-redux/actions/channels';
import type {ActionResult} from 'mattermost-redux/types/actions';

import Textbox from 'components/textbox';
import type {TextboxElement} from 'components/textbox';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import {isChannelNamesMap} from 'utils/text_formatting';

import {ChannelHeaderTextPopover} from './channel_header_text_popover';

import './channel_header_inline_edit.scss';

const CHANNEL_HEADER_MAX_LENGTH = 1024;

type Props = {
    channel: Channel;
    headerText: string;
    canEdit: boolean;
};

export default function ChannelHeaderInlineEdit({channel, headerText, canEdit}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(headerText);
    const [saving, setSaving] = useState(false);
    const [isTooLong, setIsTooLong] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const hasHeaderText = headerText.trim().length > 0;
    const hasError = isTooLong || Boolean(serverError);

    useEffect(() => {
        if (!isEditing) {
            setDraft(headerText);
        }
    }, [headerText, isEditing]);

    const startEditing = useCallback(() => {
        if (!canEdit) {
            return;
        }
        setDraft(headerText);
        setIsTooLong(false);
        setServerError(null);
        setIsEditing(true);
    }, [canEdit, headerText]);

    const cancelEditing = useCallback(() => {
        setDraft(headerText);
        setIsTooLong(false);
        setServerError(null);
        setSaving(false);
        setIsEditing(false);
    }, [headerText]);

    const saveHeader = useCallback(async () => {
        const nextHeader = draft.trim();
        if (nextHeader.length > CHANNEL_HEADER_MAX_LENGTH) {
            setIsTooLong(true);
            setServerError(null);
            return;
        }

        if (nextHeader === headerText.trim()) {
            setIsEditing(false);
            setIsTooLong(false);
            setServerError(null);
            return;
        }

        setSaving(true);
        const {error} = await dispatch(patchChannel(channel.id, {header: nextHeader})) as ActionResult;
        if (error) {
            const tooLong = error.server_error_id === 'model.channel.is_valid.header.app_error';
            setIsTooLong(tooLong);
            setServerError(tooLong ? null : (error.message || null));
            setSaving(false);
            return;
        }

        setSaving(false);
        setIsTooLong(false);
        setServerError(null);
        setIsEditing(false);
    }, [channel.id, dispatch, draft, headerText]);

    const handleChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        const nextValue = e.target.value;
        setDraft(nextValue);
        setIsTooLong(nextValue.length > CHANNEL_HEADER_MAX_LENGTH);
        setServerError(null);
    }, []);

    const handleKeyPress = useCallback((e: React.KeyboardEvent<TextboxElement>) => {
        if (isKeyPressed(e, Constants.KeyCodes.ENTER) && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            saveHeader();
        }
    }, [saveHeader]);

    const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isKeyPressed(e, Constants.KeyCodes.ESCAPE)) {
            e.preventDefault();
            e.stopPropagation();
            cancelEditing();
        }
    }, [cancelEditing]);

    if (isEditing) {
        return (
            <div
                className='ChannelHeaderInlineEdit ChannelHeaderInlineEdit--editing'
                onKeyDown={handleEditorKeyDown}
            >
                <div className='ChannelHeaderInlineEdit__editor'>
                    <Textbox
                        id='channel_header_inline_edit_textbox'
                        channelId={channel.id}
                        value={draft}
                        onChange={handleChange}
                        onKeyPress={handleKeyPress}
                        createMessage={formatMessage({
                            id: 'edit_channel_header_modal.placeholder',
                            defaultMessage: 'Enter the Channel Header',
                        })}
                        characterLimit={CHANNEL_HEADER_MAX_LENGTH}
                        supportsCommands={false}
                        suggestionListPosition='bottom'
                        useChannelMentions={false}
                    />
                    <div className='ChannelHeaderInlineEdit__actions'>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            size='xs'
                            onClick={cancelEditing}
                            disabled={saving}
                        >
                            <FormattedMessage
                                id='edit_channel_header_modal.cancel'
                                defaultMessage='Cancel'
                            />
                        </Button>
                        <Button
                            type='button'
                            emphasis='primary'
                            size='xs'
                            onClick={saveHeader}
                            disabled={saving || isTooLong}
                        >
                            <FormattedMessage
                                id='edit_channel_header_modal.save'
                                defaultMessage='Save'
                            />
                        </Button>
                    </div>
                    {hasError && (
                        <div
                            className='ChannelHeaderInlineEdit__error'
                            role='alert'
                        >
                            {isTooLong ? (
                                <FormattedMessage
                                    id='edit_channel_header_modal.error'
                                    defaultMessage='The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.'
                                    values={{maxLength: CHANNEL_HEADER_MAX_LENGTH}}
                                />
                            ) : serverError}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (!hasHeaderText) {
        if (!canEdit) {
            return null;
        }

        return (
            <button
                type='button'
                className='header-placeholder ChannelHeaderInlineEdit__placeholder'
                onClick={startEditing}
                aria-label={formatMessage({
                    id: 'channel_header.headerText.addNewButton',
                    defaultMessage: 'Add a channel header',
                })}
            >
                <span>
                    <FormattedMessage
                        id='channel_header.headerText.addNewButton'
                        defaultMessage='Add a channel header'
                    />
                </span>
                <i
                    className='icon icon-pencil-outline'
                    aria-hidden={true}
                />
            </button>
        );
    }

    const editLabel = formatMessage({
        id: 'channel_info_rhs.about_area.edit_channel_header',
        defaultMessage: 'Edit channel header',
    });

    return (
        <div
            className={classNames('ChannelHeaderInlineEdit', {
                'ChannelHeaderInlineEdit--editable': canEdit,
            })}
        >
            <div
                className={classNames('ChannelHeaderInlineEdit__view', {
                    editable: canEdit,
                })}
            >
                <ChannelHeaderTextPopover
                    text={headerText}
                    channelMentionsNameMap={
                        isChannelNamesMap(channel.props?.channel_mentions) ? channel.props.channel_mentions : undefined
                    }
                />
                {canEdit && (
                    <WithTooltip title={editLabel}>
                        <button
                            type='button'
                            className='ChannelHeaderInlineEdit__edit-icon'
                            onClick={startEditing}
                            aria-label={editLabel}
                        >
                            <i
                                className='icon icon-pencil-outline'
                                aria-hidden={true}
                            />
                        </button>
                    </WithTooltip>
                )}
            </div>
        </div>
    );
}
