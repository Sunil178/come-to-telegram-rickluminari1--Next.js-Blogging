import { Types } from "mongoose";
import User from "@/models/User";
import PublishRequest from "@/models/PublishRequest";
import Comment from "@/models/Comment";
import PostVote from "@/models/PostVote";
import CommentVote from "@/models/CommentVote";
import type { IpRecord } from "@/libs/geoip";
import type { PrivateDetails, PublicProfile } from "@/libs/profile";

export interface Applicant {
    request: {
        id: string;
        status: string;
        motivation: string;
        writingSample: string;
        requestedFrom: IpRecord | null;
        createdAt: Date;
        reviewedAt: Date | null;
    };
    user: {
        id: string;
        username: string;
        name: string;
        email: string;
        role: string;
        avatar: string;
        profile: PublicProfile;
        privateDetails: PrivateDetails;
        emailVerifiedAt: Date | null | undefined;
        createdAt: Date;
        signup: IpRecord | null;
        lastLogin: IpRecord | null;
        profileScore: number;
    };
    activity: {
        comments: number;
        commentUpvotes: number;
        commentDownvotes: number;
        votesCast: number;
        earlierRequests: { status: string; createdAt: Date }[];
    };
}

/** Everything an admin needs to judge a request to publish: the application, the profile, the activity and the addresses. */
export async function loadApplicant(requestId: string): Promise<Applicant | null> {
    const request = await PublishRequest.findById(requestId).lean<{
        _id: Types.ObjectId; userId: Types.ObjectId; status: string; motivation?: string; writingSample?: string;
        requestedFrom?: IpRecord | null; createdAt: Date; reviewedAt: Date | null;
    }>();
    if (!request) return null;
    const user = await User.findById(request.userId)
        .select("username firstName middleName lastName email role avatar profile privateDetails emailVerifiedAt createdAt signup lastLogin upvoteCount downvoteCount")
        .lean<{
            _id: Types.ObjectId; username: string; firstName?: string; middleName?: string; lastName?: string; email: string; role: string; avatar?: string;
            profile?: PublicProfile; privateDetails?: PrivateDetails; emailVerifiedAt?: Date | null; createdAt: Date;
            signup?: IpRecord | null; lastLogin?: IpRecord | null; upvoteCount?: number; downvoteCount?: number;
        }>();
    if (!user) return null;

    const [comments, commentScores, postVotes, commentVotes, earlierRequests] = await Promise.all([
        Comment.countDocuments({ userId: user._id }),
        Comment.aggregate<{ up: number; down: number }>([
            { $match: { userId: user._id, deleted: { $ne: true } } },
            { $group: { _id: null, up: { $sum: "$upvoteCount" }, down: { $sum: "$downvoteCount" } } },
        ]),
        PostVote.countDocuments({ userId: user._id }),
        CommentVote.countDocuments({ userId: user._id }),
        PublishRequest.find({ userId: user._id, _id: { $ne: request._id } }).select("status createdAt").sort({ createdAt: -1 }).lean<{ status: string; createdAt: Date }[]>(),
    ]);

    return {
        request: {
            id: request._id.toString(),
            status: request.status,
            motivation: request.motivation ?? "",
            writingSample: request.writingSample ?? "",
            requestedFrom: request.requestedFrom ?? null,
            createdAt: request.createdAt,
            reviewedAt: request.reviewedAt,
        },
        user: {
            id: user._id.toString(),
            username: user.username,
            name: [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" "),
            email: user.email,
            role: user.role,
            avatar: user.avatar ?? "",
            profile: user.profile ?? {},
            privateDetails: user.privateDetails ?? {},
            emailVerifiedAt: user.emailVerifiedAt,
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
            earlierRequests: earlierRequests.map((r) => ({ status: r.status, createdAt: r.createdAt })),
        },
    };
}
