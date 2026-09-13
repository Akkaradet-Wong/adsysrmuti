module.exports = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "ไม่มีสิทธิ์เข้าถึง",
      });
    }
    next();
  };
};