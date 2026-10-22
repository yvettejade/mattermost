// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {EyeOutlineIcon, PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {createPoll} from 'actions/views/polls';

import Input from 'components/widgets/inputs/input/input';

import {generateId} from 'utils/utils';

import {POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, POLL_OPTION_MAX_LENGTH, POLL_QUESTION_MAX_LENGTH, pollMessages} from './utils';

import './poll_create_modal.scss';

type Props = {
    channelId: string;
    rootId: string;
    onExited: () => void;
};

type DraftOption = {
    id: string;
    text: string;
};

const newOption = (): DraftOption => ({id: generateId(), text: ''});

const PollCreateModal = ({channelId, rootId, onExited}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [show, setShow] = useState(true);
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState<DraftOption[]>(() => [newOption(), newOption()]);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const filledOptions = options.filter((option) => option.text.trim());
    const isValid = Boolean(question.trim()) && filledOptions.length >= POLL_MIN_OPTIONS;

    const updateOption = useCallback((id: string, text: string) => {
        setOptions((current) => current.map((option) => (option.id === id ? {...option, text} : option)));
    }, []);

    const removeOption = useCallback((id: string) => {
        setOptions((current) => current.filter((option) => option.id !== id));
    }, []);

    const addOption = useCallback(() => {
        setOptions((current) => (current.length < POLL_MAX_OPTIONS ? [...current, newOption()] : current));
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!isValid || saving) {
            return;
        }

        setSaving(true);
        const {error} = await dispatch(createPoll(channelId, rootId, {
            question: question.trim(),
            options: filledOptions.map(({id, text}) => ({id, text: text.trim()})),
        }));
        setSaving(false);

        if (error) {
            setSaveError(formatMessage(msg.saveError));
            return;
        }

        setShow(false);
    }, [dispatch, formatMessage, isValid, saving, channelId, rootId, question, filledOptions]);

    const handleCancel = useCallback(() => setShow(false), []);

    return (
        <GenericModal
            className='PollCreateModal'
            id='pollCreateModal'
            modalHeaderText={formatMessage(msg.heading)}
            confirmButtonText={formatMessage(msg.confirm)}
            cancelButtonText={formatMessage(msg.cancel)}
            show={show}
            handleConfirm={handleConfirm}
            handleEnterKeyPress={handleConfirm}
            handleCancel={handleCancel}
            onHide={handleCancel}
            onExited={onExited}
            isConfirmDisabled={!isValid || saving}
            autoCloseOnConfirmButton={false}
            compassDesign={true}
            errorText={saveError}
        >
            <div className='PollCreateModal__body'>
                <Input
                    name='poll-question'
                    data-testid='pollQuestionInput'
                    label={formatMessage(msg.questionLabel)}
                    placeholder={formatMessage(msg.questionPlaceholder)}
                    value={question}
                    maxLength={POLL_QUESTION_MAX_LENGTH}
                    onChange={(e) => setQuestion(e.target.value)}
                    autoFocus={true}
                />

                <div className='PollCreateModal__sectionLabel'>
                    {formatMessage(msg.optionsLabel)}
                </div>
                <ol className='PollCreateModal__options'>
                    {options.map((option, index) => (
                        <li
                            key={option.id}
                            className='PollCreateModal__option'
                        >
                            <Input
                                name={`poll-option-${index + 1}`}
                                data-testid={`pollOptionInput-${index}`}
                                containerClassName='PollCreateModal__optionInput'
                                placeholder={formatMessage(msg.optionPlaceholder, {number: index + 1})}
                                value={option.text}
                                maxLength={POLL_OPTION_MAX_LENGTH}
                                onChange={(e) => updateOption(option.id, e.target.value)}
                            />
                            {options.length > POLL_MIN_OPTIONS && (
                                <WithTooltip title={formatMessage(msg.removeOption)}>
                                    <button
                                        type='button'
                                        className='PollCreateModal__remove btn btn-icon btn-sm'
                                        aria-label={formatMessage(msg.removeOptionAria, {number: index + 1})}
                                        onClick={() => removeOption(option.id)}
                                    >
                                        <TrashCanOutlineIcon size={18}/>
                                    </button>
                                </WithTooltip>
                            )}
                        </li>
                    ))}
                </ol>

                <button
                    type='button'
                    className='PollCreateModal__add btn btn-tertiary btn-sm'
                    onClick={addOption}
                    disabled={options.length >= POLL_MAX_OPTIONS}
                >
                    <PlusIcon size={16}/>
                    {formatMessage(msg.addOption)}
                </button>

                <div
                    className='PollCreateModal__notice'
                    data-testid='pollVisibilityNotice'
                >
                    <EyeOutlineIcon size={16}/>
                    {formatMessage(pollMessages.visibilityNotice)}
                </div>
            </div>
        </GenericModal>
    );
};

const msg = defineMessages({
    heading: {id: 'poll.create.heading', defaultMessage: 'Create a poll'},
    confirm: {id: 'poll.create.confirm', defaultMessage: 'Post poll'},
    cancel: {id: 'poll.create.cancel', defaultMessage: 'Cancel'},
    questionLabel: {id: 'poll.create.question_label', defaultMessage: 'Question'},
    questionPlaceholder: {id: 'poll.create.question_placeholder', defaultMessage: 'What do you want to ask?'},
    optionsLabel: {id: 'poll.create.options_label', defaultMessage: 'Options'},
    optionPlaceholder: {id: 'poll.create.option_placeholder', defaultMessage: 'Option {number}'},
    addOption: {id: 'poll.create.add_option', defaultMessage: 'Add option'},
    removeOption: {id: 'poll.create.remove_option', defaultMessage: 'Remove option'},
    removeOptionAria: {id: 'poll.create.remove_option_aria', defaultMessage: 'Remove option {number}'},
    saveError: {id: 'poll.create.save_error', defaultMessage: 'Something went wrong while posting the poll. Please try again.'},
});

export default PollCreateModal;
