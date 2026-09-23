import { hash, id } from "@kinarajs/kinara";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  roles: string[];
}

const users = new Map<string, User>();
const tokens = new Map<string, string>();

export function createUser(email: string, password: string): User {
  const user: User = {
    id: id(),
    email: email.toLowerCase(),
    passwordHash: hash(password),
    roles: ["member"],
  };
  users.set(user.id, user);
  return user;
}

export function findByEmail(email: string): User | undefined {
  return [...users.values()].find((user) => user.email === email.toLowerCase());
}

export function findById(userId: string): User | undefined {
  return users.get(userId);
}

export function issueToken(user: User): string {
  const token = id(24);
  tokens.set(token, user.id);
  return token;
}

export function userFromToken(token: string): User | undefined {
  const userId = tokens.get(token);
  return userId ? users.get(userId) : undefined;
}

export function publicUser(user: User) {
  return { id: user.id, email: user.email, roles: user.roles };
}
