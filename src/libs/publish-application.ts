import type { ProfileField } from "@/libs/profile";

// The request-to-publish form: why they want to write and a sample stay with the request;
// the profile fields it shows are saved to the applicant's profile.
export const MOTIVATION_LENGTH = { min: 20, max: 2000 };
export const SAMPLE_LENGTH = { min: 100, max: 10000 };
export const APPLICATION_PROFILE_FIELDS: ProfileField[] = ["headline", "bio", "website", "links", "expertise", "topics"];
