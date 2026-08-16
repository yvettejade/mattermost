// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {DRAFT_URL_SUFFIX} from 'utils/constants';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import './message_templates.scss';

const MESSAGE_TEMPLATES = [
    {
        id: 'standup',
        nameId: 'message_templates.standup.name',
        nameDefault: 'Daily standup',
        descriptionId: 'message_templates.standup.description',
        descriptionDefault: 'Share yesterday, today, and blockers.',
    },
    {
        id: 'incident',
        nameId: 'message_templates.incident.name',
        nameDefault: 'Incident update',
        descriptionId: 'message_templates.incident.description',
        descriptionDefault: 'Post status, impact, and next steps.',
    },
    {
        id: 'status',
        nameId: 'message_templates.status.name',
        nameDefault: 'Weekly status',
        descriptionId: 'message_templates.status.description',
        descriptionDefault: 'Summarize progress, risks, and asks.',
    },
] as const;

export default function MessageTemplates() {
    const dispatch = useDispatch();
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const handleBackToDrafts = () => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}/${DRAFT_URL_SUFFIX}`);
    };

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
                        defaultMessage='Saved message templates you can reuse in drafts'
                    />
                }
                right={
                    <Button
                        type='button'
                        id='backToDraftsButton'
                        emphasis='tertiary'
                        size='sm'
                        onClick={handleBackToDrafts}
                        disabled={!currentTeamName}
                    >
                        <FormattedMessage
                            id='message_templates.backToDrafts'
                            defaultMessage='Back to drafts'
                        />
                    </Button>
                }
            />
            <div className='MessageTemplates__main'>
                <table className='MessageTemplates__table'>
                    <caption className='sr-only'>
                        <FormattedMessage
                            id='message_templates.tableCaption'
                            defaultMessage='Message templates'
                        />
                    </caption>
                    <thead>
                        <tr>
                            <th scope='col'>
                                <FormattedMessage
                                    id='message_templates.column.name'
                                    defaultMessage='Name'
                                />
                            </th>
                            <th scope='col'>
                                <FormattedMessage
                                    id='message_templates.column.description'
                                    defaultMessage='Description'
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {MESSAGE_TEMPLATES.map((template) => (
                            <tr key={template.id}>
                                <th scope='row'>
                                    <FormattedMessage
                                        id={template.nameId}
                                        defaultMessage={template.nameDefault}
                                    />
                                </th>
                                <td>
                                    <FormattedMessage
                                        id={template.descriptionId}
                                        defaultMessage={template.descriptionDefault}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
