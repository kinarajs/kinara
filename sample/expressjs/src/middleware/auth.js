export default () => (req, res, next) => {
  if (req.headers.authorization) {
    next();
    return;
  }
  res.status(401).json({ error: "unauthorized" });
};
