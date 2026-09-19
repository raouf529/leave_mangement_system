const jws = require('jsonwebtoken');
const pool = require('../db');

// Middleware to authenticate JWT token (read from the httpOnly cookie)
const authenticateToken = (req, res, next) => {
    try {
        const token = req.cookies?.accessToken;

        if (!token) {
            return res.status(401).json({ message: 'Le jeton d’accès est requis.' });
        }

        jws.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ message: 'Le jeton d’accès est invalide ou expiré.' });
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
                return res.status(403).json({ message: 'Vous n’avez pas les permissions nécessaires pour effectuer cette action.' });
            }
            next();
        } catch (error) {
            res.status(500).json({ message: 'Error occurred while authorizing roles' });
        }
    };
};

const authorizeRequestAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Vous devez être connecté pour effectuer cette action.' });
        }

        const requestId = req.params?.requestId;
        if (!requestId) {
            return next();
        }

        const [requestRows] = await pool.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
        if (requestRows.length === 0) {
            return res.status(404).json({ message: 'La demande de congé est introuvable.' });
        }

        const isOwner = Number(requestRows[0].Emp_id) === Number(req.user.id);
        const isManager = ['head', 'hr'].includes(req.user.role);

        if (isOwner || isManager) {
            return next();
        }

        return res.status(403).json({ message: 'Vous n’êtes pas autorisé à accéder à cette demande de congé.' });
    } catch (error) {
        res.status(500).json({ message: 'Error occurred while authorizing leave request access' });
    }
};

const authorizeRequestStepAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Vous devez être connecté pour effectuer cette action.' });
        }

        const stepId = req.params?.stepId;
        if (!stepId) {
            return next();
        }

        const [stepRows] = await pool.query('SELECT * FROM Request_step WHERE step_id = ?', [stepId]);
        if (stepRows.length === 0) {
            return res.status(404).json({ message: 'L’étape de la demande de congé est introuvable.' });
        }

        const isAssignedTarget = Number(stepRows[0].target_id) === Number(req.user.id);
        const isManager = ['head', 'hr'].includes(req.user.role);

        if (isAssignedTarget || isManager) {
            return next();
        }

        return res.status(403).json({ message: 'Vous n’êtes pas autorisé à traiter cette étape de demande.' });
    } catch (error) {
        res.status(500).json({ message: 'Error occurred while authorizing request step access' });
    }
};

const authorizeRequestTargetAccess = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Vous devez être connecté pour effectuer cette action.' });
        }

        const targetId = req.params?.targetId;
        if (!targetId) {
            return next();
        }

        const isOwnTarget = Number(targetId) === Number(req.user.id);
        const isManager = ['head', 'hr'].includes(req.user.role);

        if (isOwnTarget || isManager) {
            return next();
        }

        return res.status(403).json({ message: 'Vous n’êtes pas autorisé à consulter ces étapes de demande.' });
    } catch (error) {
        res.status(500).json({ message: 'Error occurred while authorizing request step target access' });
    }
};

// restrict access to own profile or managerial profiles for head/hr users
const authorizeProfileAccess = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Vous devez être connecté pour effectuer cette action.' });
        }

        const requestedId = req.params && req.params.id !== undefined ? Number(req.params.id) : null;
        const currentUserId = Number(req.user.id);

        if (requestedId === currentUserId) {
            return next();
        }

        if (['head', 'hr', 'admin'].includes(req.user.role)) {
            return next();
        }

        return res.status(403).json({ message: 'Vous n’avez pas l’autorisation d’accéder à ce profil.' });
    } catch (error) {
        res.status(500).json({ message: 'Error occurred while authorizing profile access' });
    }
};

module.exports = { authenticateToken, authorizeRoles, authorizeProfileAccess, authorizeRequestAccess, authorizeRequestStepAccess, authorizeRequestTargetAccess };