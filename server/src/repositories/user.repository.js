import { db } from "../prisma/db.ts";

export const userRepository = {
  findByEmail(email) {
    return db.orm.public.User.where({ email }).first();
  },

  findById(id) {
    return db.orm.public.User.first({ id });
  },

  create({ name, email, passwordHash, role }) {
    return db.orm.public.User.create({
      name,
      email,
      passwordHash,
      role,
    });
  },

  deleteById(id) {
    return db.orm.public.User.where({ id }).delete();
  },
};
