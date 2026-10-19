// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelSearchOpts} from '@mattermost/types/channels';
import type {GetFilteredUsersStatsOpts} from '@mattermost/types/users';

import {SearchTypes} from 'utils/constants';

import type {ModalFilters} from 'types/store/views';

export function setModalSearchTerm(term: string) {
    return {
        type: SearchTypes.SET_MODAL_SEARCH,
        data: term,
    };
}

export function setPopoverSearchTerm(term: string) {
    return {
        type: SearchTypes.SET_POPOVER_SEARCH,
        data: term,
    };
}

export function setChannelMembersRhsSearchTerm(term: string) {
    return {
        type: SearchTypes.SET_CHANNEL_MEMBERS_RHS_SEARCH,
        data: term,
    };
}

export function setModalFilters(filters: ModalFilters = {}) {
    return {
        type: SearchTypes.SET_MODAL_FILTERS,
        data: filters,
    };
}

export function setUserGridSearch(term: string) {
    return {
        type: SearchTypes.SET_USER_GRID_SEARCH,
        data: term,
    };
}

export function setUserGridFilters(filters: GetFilteredUsersStatsOpts = {}) {
    return {
        type: SearchTypes.SET_USER_GRID_FILTERS,
        data: filters,
    };
}

export function setTeamListSearch(term: string) {
    return {
        type: SearchTypes.SET_TEAM_LIST_SEARCH,
        data: term,
    };
}

export function setChannelListSearch(term: string) {
    return {
        type: SearchTypes.SET_CHANNEL_LIST_SEARCH,
        data: term,
    };
}

export function setChannelListFilters(filters: ChannelSearchOpts = {}) {
    return {
        type: SearchTypes.SET_CHANNEL_LIST_FILTERS,
        data: filters,
    };
}
