import { defineHook } from "@kinarajs/kinara";

export default defineHook({
  id: "log-user-signup",
  name: "Log user signup",
  on: "user.created",
  async handle(payload) {
    console.log("[hook] user.created ->", payload);
  },
});
