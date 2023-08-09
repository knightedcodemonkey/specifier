import type { Match } from './user.js';

declare namespace Express {
  interface Request {
    match: Match;
    user: import("./user.js").User;
  }
}

export type { Match, Express }
