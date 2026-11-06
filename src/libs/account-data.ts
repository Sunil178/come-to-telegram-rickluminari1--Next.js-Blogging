import type { Types } from "mongoose";
import type { SoftDeleteModel } from "mongoose-delete";
import User from "@/models/User";
import Post, { type IPost } from "@/models/Post";
import Comment, { type IComment } from "@/models/Comment";
import PostVote, { type IPostVote } from "@/models/PostVote";
import CommentVote, { type ICommentVote } from "@/models/CommentVote";
import UserVote, { type IUserVote } from "@/models/UserVote";
import PostRevision from "@/models/PostRevision";
import Notification from "@/models/Notification";
import PushSubscription from "@/models/PushSubscription";
import AuthToken from "@/models/AuthToken";
import PublishRequest from "@/models/PublishRequest";
import VisitorEvent from "@/models/VisitorEvent";
import Upload from "@/models/Upload";
import ContactMessage from "@/models/ContactMessage";
import { ROLES } from "@/libs/roles";
import { UPLOAD_URL_PREFIX } from "@/libs/uploads";
import { removeUploadIfUnused, uploadUrlsIn } from "@/libs/upload-cleanup";

const SoftPost = Post as unknown as SoftDeleteModel<IPost>;
const SoftComment = Comment as unknown as SoftDeleteModel<IComment>;
const SoftPostVote = PostVote as unknown as SoftDeleteModel<IPostVote>;
const SoftCommentVote = CommentVote as unknown as SoftDeleteModel<ICommentVote>;
const SoftUserVote = UserVote as unknown as SoftDeleteModel<IUserVote>;

type Id = Types.ObjectId | string;

/** Everything stored about the user, for the "Download my data" export. */
export async function exportAccountData(userId: string) {
    const ownPostIds = (await SoftPost.findWithDeleted({ userId }).select("_id").lean<{ _id: Types.ObjectId }[]>()).map((p) => p._id);
    const [profile, posts, revisions, comments, postVotes, commentVotes, userVotes, notifications, pushSubscriptions, publishRequests, readingHistory, uploads, contactMessages] = await Promise.all([
        User.findById(userId).select("-password -__v").lean(),
        SoftPost.findWithDeleted({ userId }).select("-__v").lean(),
        // Earlier versions of their posts, and the versions their edits replaced on anyone's post.
        PostRevision.find({ $or: [{ postId: { $in: ownPostIds } }, { editorId: userId }] }).select("-__v").lean(),
        SoftComment.findWithDeleted({ userId }).select("-__v").lean(),
        PostVote.find({ userId }).select("postId type createdAt").lean(),
        CommentVote.find({ userId }).select("commentId type createdAt").lean(),
        UserVote.find({ userId }).select("targetUserId type createdAt").lean(),
        Notification.find({ recipientId: userId }).select("-__v -recipientId").lean(),
        // The endpoint and keys are delivery secrets of the browser, not something the user needs back.
        PushSubscription.find({ userId }).select("createdAt").lean(),
        PublishRequest.find({ userId }).select("status motivation writingSample requestedFrom createdAt reviewedAt").lean(),
        VisitorEvent.find({ userId }).select("postId type createdAt").lean(),
        Upload.find({ userId, removedAt: null }).select("url purpose mimeType size originalSize width height metadata createdAt").lean(),
        ContactMessage.find({ userId }).select("reference topic name email url message status createdAt resolvedAt").lean(),
    ]);
    return {
        exportedAt: new Date().toISOString(),
        profile,
        posts,
        revisions,
        comments,
        votes: { posts: postVotes, comments: commentVotes, users: userVotes },
        notifications,
        pushSubscriptions,
        publishRequests,
        readingHistory,
        uploads,
        contactMessages,
    };
}

/** The last admin can't leave: nobody would be able to manage roles afterwards. */
export async function isLastAdmin(userId: string, role: string): Promise<boolean> {
    if (role !== ROLES.ADMIN) return false;
    return (await User.countDocuments({ role: ROLES.ADMIN, _id: { $ne: userId } })) === 0;
}

// Votes are deleted before the counters are corrected, so a retry after a failure can't subtract twice.
async function removeVotes(voteModel: SoftDeleteModel<any>, counterModel: SoftDeleteModel<any>, targetField: string, voterId: string, keepCountsOf: Id[]) {
    const active = await voteModel.find({ userId: voterId, [targetField]: { $nin: keepCountsOf } }).select(`${targetField} type`).lean<Record<string, unknown>[]>();
    await voteModel.deleteMany({ userId: voterId });
    if (active.length === 0) return;
    await counterModel.bulkWrite(active.map((vote) => ({
        updateOne: { filter: { _id: vote[targetField] }, update: { $inc: { [vote.type ? "upvoteCount" : "downvoteCount"]: -1 } } },
    })));
}

// Site-relative upload URLs only (an attribute value starting with /uploads/), never another site's /uploads/ path.
function uploadedFiles(posts: { bannerImage?: string; content?: string }[]): string[] {
    const urls = posts.flatMap((post) => [post.bannerImage ?? "", ...uploadUrlsIn(post.content)]);
    return [...new Set(urls.filter((url) => url.startsWith(`${UPLOAD_URL_PREFIX}/`)))];
}

/**
 * Permanently deletes the account: the user's own content goes with it, their
 * comments under other people's posts become "[deleted]" placeholders so replies keep their thread.
 * The user record is removed after the content, so a failure part-way can be retried by signing in again;
 * its uploaded files go last, once nothing references them.
 */
export async function deleteAccount(userId: string): Promise<void> {
    const posts = await SoftPost.findWithDeleted({ userId }).select("_id bannerImage content").lean<{ _id: Types.ObjectId; bannerImage?: string; content?: string }[]>();
    const postIds = posts.map((post) => post._id);
    const ownPostCommentIds = (await SoftComment.findWithDeleted({ postId: { $in: postIds } }).select("_id").lean<{ _id: Types.ObjectId }[]>()).map((c) => c._id);

    await removeVotes(SoftPostVote, SoftPost, "postId", userId, postIds);
    await removeVotes(SoftCommentVote, SoftComment, "commentId", userId, ownPostCommentIds);
    await removeVotes(SoftUserVote, User as unknown as SoftDeleteModel<any>, "targetUserId", userId, [userId]);

    // Comments elsewhere: counted off their posts like a normal delete, and the text is erased.
    const liveComments = await Comment.find({ userId, postId: { $nin: postIds } }).select("postId").lean<{ postId: Types.ObjectId }[]>();
    await SoftComment.updateManyWithDeleted(
        { userId, postId: { $nin: postIds } },
        { $set: { content: "[deleted]", deleted: true, deletedAt: new Date(), deletedBy: userId } }
    );
    if (liveComments.length > 0) {
        await Post.bulkWrite(liveComments.map((c) => ({ updateOne: { filter: { _id: c.postId }, update: { $inc: { commentCount: -1 } } } })));
    }

    await Promise.all([
        Comment.deleteMany({ postId: { $in: postIds } }),
        CommentVote.deleteMany({ commentId: { $in: ownPostCommentIds } }),
        PostVote.deleteMany({ postId: { $in: postIds } }),
        UserVote.deleteMany({ targetUserId: userId }),
        PostRevision.deleteMany({ postId: { $in: postIds } }),
        Notification.deleteMany({ $or: [{ recipientId: userId }, { actorId: userId }, { postId: { $in: postIds } }] }),
        PushSubscription.deleteMany({ userId }),
        AuthToken.deleteMany({ userId }),
        PublishRequest.deleteMany({ userId }),
        VisitorEvent.deleteMany({ userId }),
        // A complaint stays on record until it expires (ContactMessage), no longer tied to the deleted account.
        ContactMessage.updateMany({ userId }, { $set: { userId: null } }),
    ]);
    await Post.deleteMany({ _id: { $in: postIds } });
    const avatar = (await User.findById(userId).select("avatar").lean<{ avatar?: string }>())?.avatar;
    await User.deleteOne({ _id: userId });

    // Another author may have reused the same image URL; their copy keeps working.
    const recorded = (await Upload.find({ userId }).select("url").lean<{ url: string }[]>()).map((upload) => upload.url);
    for (const url of new Set([...uploadedFiles(posts), ...(avatar ? [avatar] : []), ...recorded])) await removeUploadIfUnused(url);
    // Files kept for someone else's post lose their record, and with it the photo metadata.
    await Upload.deleteMany({ userId });
}
