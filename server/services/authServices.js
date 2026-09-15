const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

function generatePassword() {
    const length = 8;
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function mapRole(role) {
    if (role === 'drh') return 'hr';
    if (['directeur', 'chef_departement', 'chef_service'].includes(role)) return 'head';
    if (role === 'employe') return 'employee';
    return role;
}

function getRoleLabel(role) {
    const labels = {
        directeur: 'Directeur',
        chef_departement: 'Chef de département',
        chef_service: 'Chef de service',
        drh: 'Ressources humaines',
        employe: 'Employé'
    };
    return labels[role] ?? role;
}

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
            throw new Error('Invalid email or password');
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid email or password');
        }

        const { accessToken, refreshToken } = generateTokens(user);
        return { accessToken, refreshToken, role: mapRole(user.role), roleLabel: getRoleLabel(user.role) };
    },

    // Used by the refresh endpoint to rebuild a fresh access token payload
    // (role/unit could have changed since the refresh token was issued).
    async getEmployeeById(id) {
        const [users] = await pool.query('SELECT * FROM Employe WHERE id = ?', [id]);
        if (users.length === 0) {
            throw new Error('User not found');
        }
        return users[0];
    },

    verifyRefreshToken,
    generateTokens,
};

module.exports = authService;