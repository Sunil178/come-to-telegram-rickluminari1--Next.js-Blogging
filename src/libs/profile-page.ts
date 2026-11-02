import { cache } from "react";
import type { Types } from "mongoose";
import User from "@/models/User";
import type { PublicProfile } from "@/libs/profile";

/** The account at this profile address, or null; cached per request for the layout, metadata and page. */
export const getProfileUser = cache(async (rawUsername: string) =>
    User.findOne({ username: decodeURIComponent(rawUsername) })
        .select("username avatar profile upvoteCount downvoteCount")
        .lean<{ _id: Types.ObjectId; username: string; avatar?: string; profile?: PublicProfile; upvoteCount?: number; downvoteCount?: number }>(),
);
