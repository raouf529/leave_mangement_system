const jws = require('jsonwebtoken');

// Middleware to authenticate JWT token (read from the httpOnly cookie)
const authenticateToken = (req, res, next) => {
    try {
        const token = req.cookies?.accessToken;

        if (!token) {
            return res.status(401).json({ message: 'Access token required' });
        }

        jws.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ message: 'Invalid or expired token' });
            }
            req.user = user;
            next();
        });
    } catch (error) {
        res.status(500).json({ message: 'Error occurred while authenticating token' });
    }
};

// middleware to authorize based on user roles
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user || !allowedRoles.includes(req.user.role)) {
                return res.status(403).json({ message: 'You do not have permission to perform this action' });
            }
            next();
        } catch (error) {
            res.status(500).json({ message: 'Error occurred while authorizing roles' });
        }
    };
};

module.exports = { authenticateToken, authorizeRoles };