import type { Match } from './types.js' assert { 'resolution-mode': 'import' }

/**
 * Taken (mostly) from
 * @see https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html
 */

interface User {
  match: Match;
  name: string;
  id: number;
}

class UserAccount {
  match: Match = false;
  name: string;
  id: number;

  constructor(name: string, id: number) {
    this.name = name;
    this.id = id;
  }
}

const user: User = new UserAccount("Murphy", 1);

export { user }
