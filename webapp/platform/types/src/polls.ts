// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type PollOption = {
    id: string;
    text: string;
};

export type Poll = {
    question: string;
    options: PollOption[];
};

export type PollResults = {
    post_id: string;

    /** Voter user IDs per option ID, earliest voter first. */
    votes: Record<string, string[]>;
    total_votes: number;

    /** Increases with every server write; older results must not replace newer ones. */
    update_at: number;
};
