import { NotFoundError, defineRpc } from "@kinarajs/kinara";
import { findById, publicUser } from "./store.js";

export default defineRpc({
  package: "auth.v1",
  service: "AuthService",
  proto: `
    syntax = "proto3";
    package auth.v1;
    service AuthService { rpc GetUser (GetUserRequest) returns (User); }
    message GetUserRequest { string id = 1; }
    message User { string id = 1; string email = 2; }
  `,
  methods: {
    GetUser: async (req) => {
      const user = findById(String(req.id ?? ""));
      if (!user) throw new NotFoundError("User");
      return publicUser(user);
    },
  },
});
