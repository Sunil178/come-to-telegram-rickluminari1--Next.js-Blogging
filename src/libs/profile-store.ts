import User from "@/models/User";

/** Saves parsed profile fields (parseProfileInput's $set). */
export async function saveProfileFields(userId: string, set: Record<string, unknown>): Promise<void> {
    if (Object.keys(set).length === 0) return;
    // Accounts from before the structured profile hold a plain string there, which a nested $set can't extend.
    await User.updateOne({ _id: userId, profile: { $type: "string" } }, { $unset: { profile: "", intro: "", mobile: "" } });
    await User.updateOne({ _id: userId }, { $set: set });
}
