import { z } from "zod";
import { VALID_ROLES } from "../configs/constants.js";

const emailSchema = z
  .string({ message: "Email wajib diisi." })
  .trim()
  .min(1, "Email wajib diisi.")
  .max(254, "Email maksimal 254 karakter.")
  .email("Format email tidak valid.")
  .transform((value) => value.toLowerCase());

const roleSchema = z
  .string({ message: "Role wajib dipilih." })
  .trim()
  .min(1, "Role wajib dipilih.")
  .transform((value) => value.toLowerCase())
  .refine((value) => VALID_ROLES.includes(value), {
    message: `Role harus salah satu dari: ${VALID_ROLES.join(", ")}.`,
  });

export const registerSchema = z.object({
  name: z
    .string({ message: "Nama wajib diisi." })
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(100, "Nama maksimal 100 karakter."),
  email: emailSchema,
  role: roleSchema,
  password: z
    .string({ message: "Password wajib diisi." })
    .min(8, "Password minimal 8 karakter.")
    .max(128, "Password maksimal 128 karakter."),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ message: "Password wajib diisi." })
    .min(1, "Password wajib diisi.")
    .max(128, "Password maksimal 128 karakter."),
});
