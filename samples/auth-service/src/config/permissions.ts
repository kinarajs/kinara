export default {
  roles: {
    admin: ["*"],
    member: ["user.read", "user.update.self"],
  },
};
