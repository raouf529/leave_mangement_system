const authService = require('../services/authServices');

const isProd = process.env.NODE_ENV === 'production';

const ACCESS_COOKIE_OPTS = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000, // 1h, matches access token expiry
};

const REFRESH_COOKIE_OPTS = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/api/auth/refresh', // only sent to the refresh route, not every request
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d, matches refresh token expiry
};

const authController = {
    async registerEmployee(req, res) {
        try {
            const { firstName, lastName, email, role, recrutement_date, unit_name, forward_drh } = req.body;
            const user = await authService.registerEmployee({ firstName, lastName, email, role, recrutement_date, unit_name, forward_drh });
            res.status(201).json({ message: 'Employee registered successfully', user });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async loginEmployee(req, res) {
        try {
            const { email, password } = req.body;
            const { accessToken, refreshToken } = await authService.loginEmployee({ email, password });

            res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTS);
            res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);

            res.status(200).json({ message: 'Login successful' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async getCurrentUser(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const user = await authService.getEmployeeById(userId);
            res.status(200).json({
                id: user.Emp_id,
                firstName: user.First_name,
                lastName: user.Last_name,
                email: user.email,
                role: user.role,
                unitId: user.unit_id,
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async refreshToken(req, res) {
        try {
            const token = req.cookies?.refreshToken;
            if (!token) {
                return res.status(401).json({ message: 'Refresh token required' });
            }

            const payload = authService.verifyRefreshToken(token);
            const user = await authService.getEmployeeById(payload.id);
            const { accessToken } = authService.generateTokens(user);

            res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTS);
            res.status(200).json({ message: 'Token refreshed' });
        } catch (error) {
            res.status(403).json({ message: 'Invalid or expired refresh token' });
        }
    },

    async logout(req, res) {
        res.clearCookie('accessToken', { httpOnly: true, secure: isProd, sameSite: 'strict' });
        res.clearCookie('refreshToken', { httpOnly: true, secure: isProd, sameSite: 'strict', path: '/api/auth/refresh' });
        res.status(200).json({ message: 'Logged out' });
    },
};

module.exports = authController;