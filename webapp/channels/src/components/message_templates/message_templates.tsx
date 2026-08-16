// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import './message_templates.scss';

type MessageTemplate = {
    id: string;
    title: {id: string; defaultMessage: string};
    body: {id: string; defaultMessage: string};
};

const MESSAGE_TEMPLATES: MessageTemplate[] = [
    {
        id: 'weekly-status',
        title: {
            id: 'message_templates.weekly_status.title',
            defaultMessage: 'Weekly status update',
        },
        body: {
            id: 'message_templates.weekly_status.body',
            defaultMessage: 'Progress this week, blockers, and next steps.',
        },
    },
    {
        id: 'meeting-notes',
        title: {
            id: 'message_templates.meeting_notes.title',
            defaultMessage: 'Meeting notes',
        },
        body: {
            id: 'message_templates.meeting_notes.body',
            defaultMessage: 'Attendees, decisions, and follow-ups.',
        },
    },
    {
        id: 'incident-update',
        title: {
            id: 'message_templates.incident_update.title',
            defaultMessage: 'Incident update',
        },
        body: {
            id: 'message_templates.incident_update.body',
            defaultMessage: 'Impact, current status, and next communication.',
        },
    },
];

export default function MessageTemplates() {
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    return (
        <div
            id='app-content'
            className='MessageTemplates app__content'
        >
            <Header
                level={2}
                className='MessageTemplates__header'
                heading={
                    <FormattedMessage
                        id='message_templates.heading'
                        defaultMessage='Templates'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='message_templates.subtitle'
                        defaultMessage='Reusable starting points for common messages'
                    />
                }
            />
            <ul className='MessageTemplates__list'>
                {MESSAGE_TEMPLATES.map((template) => (
                    <li
                        key={template.id}
                        className='MessageTemplates__item'
                    >
                        <h3 className='MessageTemplates__itemTitle'>
                            <FormattedMessage {...template.title}/>
                        </h3>
                        <p className='MessageTemplates__itemBody'>
                            <FormattedMessage {...template.body}/>
                        </p>
                    </li>
                ))}
            </ul>
        </div>
    );
}
