import { z } from "zod";

export const updateUserSchema = z.object({
  role: z.enum(["SUPER_ADMIN", "ADMIN", "CUSTOMER"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION"]).optional(),
});
