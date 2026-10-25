import { db } from "../prisma/db.ts";

export const refreshTokenRepository = {
  create({ userId, tokenHash, expiresAt }) {
    return db.orm.public.RefreshToken.create({
      userId,
      tokenHash,
      expiresAt,
    });
  },

  findByHash(tokenHash) {
    return db.orm.public.RefreshToken.where({ tokenHash }).first();
  },

  deleteByHash(tokenHash) {
    return db.orm.public.RefreshToken.where({ tokenHash }).delete();
  },

  deleteById(id) {
    return db.orm.public.RefreshToken.where({ id }).delete();
  },

  deleteExpiredForUser(userId, now = new Date().toISOString()) {
    return db.orm.public.RefreshToken.where({ userId })
      .where((token) => token.expiresAt.lt(now))
      .deleteAll();
  },
};
