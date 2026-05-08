import z from "zod";

export const signUpSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
  password: z
    .string()
    .min(6, { error: "Password must be at least 6 characters" }),
  emailRedirectTo: z.url().optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInWithPasswordSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
  password: z.string().min(1, { error: "Password is required" }),
});

export type SignInWithPasswordInput = z.infer<typeof signInWithPasswordSchema>;

export const signInWithGoogleSchema = z.object({
  redirectTo: z.url({ error: "redirectTo must be a valid URL" }),
});

export type SignInWithGoogleInput = z.infer<typeof signInWithGoogleSchema>;
