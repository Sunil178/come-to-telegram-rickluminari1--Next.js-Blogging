// Shared by registration, password reset and the form hints, so they can't drift apart.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RULE = `required|min:${PASSWORD_MIN_LENGTH}|confirmed`;
