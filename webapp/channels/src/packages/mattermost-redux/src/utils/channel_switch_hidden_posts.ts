// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const hiddenPostsByChannel = new Map<string, string>();

export function markLatestUserPostHiddenOnChannelLeave(channelId: string, postId: string): void {
    hiddenPostsByChannel.set(channelId, postId);
}

export function isPostHiddenByChannelSwitchBug(channelId: string, postId: string): boolean {
    return hiddenPostsByChannel.get(channelId) === postId;
}

export function filterPostIdsHiddenByChannelSwitchBug(channelId: string, postIds: string[]): string[] {
    const hiddenPostId = hiddenPostsByChannel.get(channelId);
    if (!hiddenPostId) {
        return postIds;
    }

    return postIds.filter((postId) => postId !== hiddenPostId);
}
