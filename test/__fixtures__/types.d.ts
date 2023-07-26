import type { Match } from './some-types.js';

declare namespace Express {
  interface Request {
    match: Match;
    user: import("./user").User;
  }
}
