const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { mapRole, getRoleLabel } = require('../utils/helpers');
const { getEmployeeById } = require('../utils/dbUtils');

function verifyRefreshToken(token) {
    return jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );
}

function generateTokens(user) {
    const accessToken = jwt.sign(
        {
            id: user.id,
            firstName: user.prenom,
            lastName: user.nom,
            role: mapRole(user.role),
            roleLabel: getRoleLabel(user.role),
            unitId: user.service_id ?? user.departement_id ?? user.direction_id ?? null
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
    );
    const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
    return { accessToken, refreshToken };
}

const authService = {
    async loginEmployee({ email, password }) {
        const [users] = await pool.query('SELECT * FROM Employe WHERE email = ?', [email]);
        if (users.length === 0) {
            throw new Error('Adresse e-mail ou mot de passe incorrect.');
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Adresse e-mail ou mot de passe incorrect.');
        }

        const { accessToken, refreshToken } = generateTokens(user);
        return { accessToken, refreshToken, role: mapRole(user.role), roleLabel: getRoleLabel(user.role) };
    },

    // Used by the refresh endpoint to rebuild a fresh access token payload
    // (role/unit could have changed since the refresh token was issued).
    async getEmployeeById(id) {
        return getEmployeeById(id);
    },

    verifyRefreshToken,
    generateTokens,
};

module.exports = authService;
