import "dotenv/config";
import { z } from "zod";

const booleanString = z.enum(["true", "false"]);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi."),
  FRONTEND_URL: z.string().min(1).default("http://localhost:3000"),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET minimal 32 karakter."),
  JWT_ISSUER: z.string().min(1).default("sepsense-api"),
  JWT_AUDIENCE: z.string().min(1).default("sepsense-client"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  COOKIE_SECURE: booleanString.optional(),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  AUTH_RATE_LIMIT_DISABLED: booleanString.default("false"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `- ${issue.path.join(".") || "ENV"}: ${issue.message}`)
    .join("\n");

  console.error(`Konfigurasi environment tidak valid:\n${details}`);
  process.exit(1);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === "production";

let cookieSecure = raw.COOKIE_SECURE
  ? raw.COOKIE_SECURE === "true"
  : isProduction;

if (raw.COOKIE_SAME_SITE === "none" && !cookieSecure) {
  console.warn(
    "[ENV] COOKIE_SAME_SITE=none membutuhkan cookie secure. COOKIE_SECURE diaktifkan otomatis.",
  );
  cookieSecure = true;
}

export const env = Object.freeze({
  nodeEnv: raw.NODE_ENV,
  isProduction,
  port: raw.PORT,
  databaseUrl: raw.DATABASE_URL,
  frontendOrigins: raw.FRONTEND_URL.split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),

  jwtAccessSecret: raw.JWT_ACCESS_SECRET,
  jwtIssuer: raw.JWT_ISSUER,
  jwtAudience: raw.JWT_AUDIENCE,
  accessTokenTtlSeconds: raw.ACCESS_TOKEN_TTL_SECONDS,
  refreshTokenTtlDays: raw.REFRESH_TOKEN_TTL_DAYS,

  cookieSecure,
  cookieSameSite: raw.COOKIE_SAME_SITE,
  trustProxy: raw.TRUST_PROXY,
  disableRateLimit: raw.AUTH_RATE_LIMIT_DISABLED === "true",
});
