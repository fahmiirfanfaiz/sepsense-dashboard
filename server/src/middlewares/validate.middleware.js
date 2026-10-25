import { AppError } from "../utils/AppError.js";

export function validate(schema) {
  return function validateBody(req, _res, next) {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      }));

      return next(
        new AppError(
          422,
          errors[0]?.message ?? "Data yang dikirim tidak valid.",
          "VALIDATION_ERROR",
          errors,
        ),
      );
    }

    req.validatedBody = result.data;
    return next();
  };
}
