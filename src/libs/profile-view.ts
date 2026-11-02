import type { ProfileFormValues } from "@/components/account/ProfileForm";
import type { PrivateDetails, PublicProfile } from "@/libs/profile";

/** A user document's profile as the account form's plain string values. */
export function toProfileFormValues(user: { username: string; avatar?: string; profile?: PublicProfile; privateDetails?: PrivateDetails }): ProfileFormValues {
    const profile = user.profile ?? {};
    const details = user.privateDetails ?? {};
    return {
        username: user.username,
        avatar: user.avatar ?? "",
        headline: profile.headline ?? "",
        bio: profile.bio ?? "",
        country: profile.country ?? "",
        city: profile.city ?? "",
        website: profile.website ?? "",
        links: profile.links ?? [],
        expertise: profile.expertise ?? [],
        topics: profile.topics ?? [],
        education: profile.education ?? "",
        dateOfBirth: details.dateOfBirth ? new Date(details.dateOfBirth).toISOString().slice(0, 10) : "",
        gender: details.gender ?? "",
        phone: details.phone ?? "",
        address: details.address ?? "",
    };
}
