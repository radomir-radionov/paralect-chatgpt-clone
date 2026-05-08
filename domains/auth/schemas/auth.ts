import z from "zod";

export const signUpSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
  password: z
    .string()
    .min(6, { error: "Password must be at least 6 characters" }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInWithPasswordSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
  password: z.string().min(1, { error: "Password is required" }),
});

export type SignInWithPasswordInput = z.infer<typeof signInWithPasswordSchema>;

/** Body must be `{}`; redirect URL is resolved on the server. */
export const signInWithGoogleSchema = z.object({}).strict();

export type SignInWithGoogleInput = z.infer<typeof signInWithGoogleSchema>;
