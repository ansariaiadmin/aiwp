import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد").max(100),
  email: z.string().trim().toLowerCase().email("ایمیل معتبر نیست"),
  password: z
    .string()
    .min(10, "رمز عبور باید حداقل ۱۰ کاراکتر باشد")
    .max(128)
    .regex(/[a-z]/, "رمز عبور باید حرف کوچک داشته باشد")
    .regex(/[A-Z]/, "رمز عبور باید حرف بزرگ داشته باشد")
    .regex(/[0-9]/, "رمز عبور باید عدد داشته باشد"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("ایمیل معتبر نیست"),
  password: z.string().min(1, "رمز عبور الزامی است"),
  totpCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email("ایمیل معتبر نیست"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(10, "رمز عبور باید حداقل ۱۰ کاراکتر باشد")
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(10, "رمز عبور باید حداقل ۱۰ کاراکتر باشد")
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});
