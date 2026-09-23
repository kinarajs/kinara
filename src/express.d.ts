declare namespace Express {
  interface Request {
    actor?: import("./auth/permissions.js").Actor;
  }
}
