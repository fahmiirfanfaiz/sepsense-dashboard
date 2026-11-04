import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import contractJson from './contract.json' with { type: 'json' };

/** @type {import('./contract.d').Contract} */
export const contract = contractFromJson(contractJson);

export const db = postgres({
  contract,
  url: process.env['DATABASE_URL'],
});
