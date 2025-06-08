// server/middleware/adminAuthMiddleware.js
const adminAuthMiddleware = (req, res, next) => {
    // This middleware assumes that req.user has already been populated
    // by the verifyToken middleware (which should run before this).
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: Admin role required.' });
    }
    next(); // User is an admin, proceed to the next handler
};

module.exports = adminAuthMiddleware;
