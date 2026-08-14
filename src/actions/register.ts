"use server";

import User from "@/models/User";
import Validator from "validatorjs";
import { hashSync } from "bcrypt";
import { redirect } from "next/navigation";

// Define the state type for better TypeScript support
export type RegisterState = {
    error?: string;
    validationErrors?: Record<string, string[]>;
    success?: boolean;
};

export async function registerAction(initialState: RegisterState, formData: FormData): Promise<RegisterState> {
    const body = Object.fromEntries(formData.entries());

    // 1. Validation Rules
    const rules = {
        username: "required|min:3",
        firstName: "required",
        lastName: "required",
        email: "required|email",
        password: "required|min:6|confirmed", // Requires password_confirmation field in UI
    };

    const validation = new Validator(body, rules);

    if (validation.fails()) {
        return {
            error: "Validation failed. Please check the fields.",
            validationErrors: validation.errors.all() as Record<string, string[]>,
        };
    }

    try {
        // 2. Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email: body.email }, { username: body.username }],
        });

        if (existingUser) {
            return { error: "User with this email or username already exists." };
        }

        // 3. Create User
        await User.create({
            username: body.username,
            firstName: body.firstName,
            middleName: body.middleName || "",
            lastName: body.lastName,
            email: body.email,
            password: hashSync(body.password as string, 10),
        });
    } catch (error: any) {
        console.error("Registration Error:", error);
        return { error: "An internal server error occurred." };
    }

    // 4. Redirect on success
    // redirect() throws an error internally, so it must be called outside the try/catch
    // or handled specifically. Next.js handles redirects in actions automatically.
    redirect("/auth/login");
}
