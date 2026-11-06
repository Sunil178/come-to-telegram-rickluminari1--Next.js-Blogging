import { cache } from "react";
import { Types } from "mongoose";
import User from "@/models/User";
import Post, { ApprovalStatus } from "@/models/Post";
import PublishRequest from "@/models/PublishRequest";
import Comment from "@/models/Comment";
import PostVote from "@/models/PostVote";
import CommentVote from "@/models/CommentVote";
import Upload from "@/models/Upload";
import type { IpRecord } from "@/libs/geoip";
import type { PrivateDetails, PublicProfile } from "@/libs/profile";
import { publicPostFilter, SHARED_POST } from "@/libs/post-visibility";
import type { RoleName } from "@/libs/roles";

export interface DossierUser {
    id: string;
    username: string;
    name: string;
    email: string;
    role: RoleName;
    avatar: string;
    profile: PublicProfile;
    privateDetails: PrivateDetails;
    emailVerifiedAt: Date | null | undefined;
    termsAcceptedAt: Date | null | undefined;
    createdAt: Date;
    signup: IpRecord | null;
    lastLogin: IpRecord | null;
    profileScore: number;
}

export interface DossierActivity {
    comments: number;
    commentUpvotes: number;
    commentDownvotes: number;
    votesCast: number;
    // Shared posts only: private posts belong to their author alone.
    posts: { published: number; awaitingReview: number; rejected: number };
    uploads: number;
    requests: { id: string; status: string; createdAt: Date }[];
}

export interface UserDossier {
    user: DossierUser;
    activity: DossierActivity;
}

export interface Applicant extends UserDossier {
    request: {
        id: string;
        status: string;
        motivation: string;
        writingSample: string;
        requestedFrom: IpRecord | null;
        createdAt: Date;
        reviewedAt: Date | null;
    };
}

/** Everything an admin sees about an account: identity, profile, private details, addresses and activity. Memoized per request (metadata and page). */
export const loadUserDossier = cache(async (userId: Types.ObjectId | string): Promise<UserDossier | null> => {
    const user = await User.findById(userId)
        .select("username firstName middleName lastName email role avatar profile privateDetails emailVerifiedAt termsAcceptedAt createdAt signup lastLogin upvoteCount downvoteCount")
        .lean<{
            _id: Types.ObjectId; username: string; firstName?: string; middleName?: string; lastName?: string; email: string; role?: RoleName; avatar?: string;
            profile?: PublicProfile; privateDetails?: PrivateDetails; emailVerifiedAt?: Date | null; termsAcceptedAt?: Date | null; createdAt: Date;
            signup?: IpRecord | null; lastLogin?: IpRecord | null; upvoteCount?: number; downvoteCount?: number;
        }>();
    if (!user) return null;

    const [comments, commentScores, postVotes, commentVotes, published, awaitingReview, rejected, uploads, requests] = await Promise.all([
        Comment.countDocuments({ userId: user._id }),
        Comment.aggregate<{ up: number; down: number }>([
            { $match: { userId: user._id, deleted: { $ne: true } } },
            { $group: { _id: null, up: { $sum: "$upvoteCount" }, down: { $sum: "$downvoteCount" } } },
        ]),
        PostVote.countDocuments({ userId: user._id }),
        CommentVote.countDocuments({ userId: user._id }),
        Post.countDocuments({ userId: user._id, ...publicPostFilter() }),
        Post.countDocuments({ userId: user._id, ...SHARED_POST, approval: ApprovalStatus.Pending }),
        Post.countDocuments({ userId: user._id, ...SHARED_POST, approval: ApprovalStatus.Rejected }),
        Upload.countDocuments({ userId: user._id, removedAt: null }),
        PublishRequest.find({ userId: user._id }).select("status createdAt").sort({ createdAt: -1 }).lean<{ _id: Types.ObjectId; status: string; createdAt: Date }[]>(),
    ]);

    return {
        user: {
            id: user._id.toString(),
            username: user.username,
            name: [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" "),
            email: user.email,
            role: user.role ?? "reader",
            avatar: user.avatar ?? "",
            profile: user.profile ?? {},
            privateDetails: user.privateDetails ?? {},
            emailVerifiedAt: user.emailVerifiedAt,
            termsAcceptedAt: user.termsAcceptedAt,
            createdAt: user.createdAt,
            signup: user.signup ?? null,
            lastLogin: user.lastLogin ?? null,
            profileScore: (user.upvoteCount ?? 0) - (user.downvoteCount ?? 0),
        },
        activity: {
            comments,
            commentUpvotes: commentScores[0]?.up ?? 0,
            commentDownvotes: commentScores[0]?.down ?? 0,
            votesCast: postVotes + commentVotes,
            posts: { published, awaitingReview, rejected },
            uploads,
            requests: requests.map((r) => ({ id: r._id.toString(), status: r.status, createdAt: r.createdAt })),
        },
    };
});

/** Everything an admin needs to judge a request to publish: the application plus the applicant's dossier. */
export async function loadApplicant(requestId: string): Promise<Applicant | null> {
    const request = await PublishRequest.findById(requestId).lean<{
        _id: Types.ObjectId; userId: Types.ObjectId; status: string; motivation?: string; writingSample?: string;
        requestedFrom?: IpRecord | null; createdAt: Date; reviewedAt: Date | null;
    }>();
    if (!request) return null;
    const dossier = await loadUserDossier(request.userId);
    if (!dossier) return null;

    return {
        ...dossier,
        request: {
            id: request._id.toString(),
            status: request.status,
            motivation: request.motivation ?? "",
            writingSample: request.writingSample ?? "",
            requestedFrom: request.requestedFrom ?? null,
            createdAt: request.createdAt,
            reviewedAt: request.reviewedAt,
        },
    };
}
