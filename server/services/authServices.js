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

function verifyRefreshToken(token) {
    return jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );
}

function generateTokens(user) {
    const accessToken = jwt.sign(
        { id: user.Emp_id, firstName: user.First_name, lastName: user.Last_name, role: user.role, unitId: user.unit_id },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
    );
    const refreshToken = jwt.sign(
        { id: user.Emp_id },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
    return { accessToken, refreshToken };
}

const authService = {
    async registerEmployee({ firstName, lastName, email, role, recrutement_date, unit_name, forward_drh }) {
        const [existingUser] = await pool.query('SELECT * FROM Employee WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            throw new Error('Email already registered');
        }

        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);

        const [units] = await pool.query('SELECT * FROM Org_unit WHERE name = ?', [unit_name]);
        if (!units || units.length === 0) {
            throw new Error(`Unit '${unit_name}' not found`);
        }
        const unit = units[0];

        let computedForwardDrh = forward_drh;
        if (computedForwardDrh === undefined) {
            if (role === 'head' && (unit.type === 'department' || unit.type === 'direction')) {
                computedForwardDrh = 1;
            } else {
                computedForwardDrh = 0;
            }
        }

        const [result] = await pool.query(
            'INSERT INTO Employee (First_name, Last_name, email, password, role, recrutement_date, unit_id, forward_drh) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [firstName, lastName, email, hashedPassword, role, recrutement_date, unit.unit_id, computedForwardDrh]
        );

        return { id: result.insertId, firstName, lastName, email, role, generatedPassword: password };
    },

    async loginEmployee({ email, password }) {
        const [users] = await pool.query('SELECT * FROM Employee WHERE email = ?', [email]);
        if (users.length === 0) {
            throw new Error('Invalid email or password');
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid email or password');
        }

        const { Emp_id, First_name, Last_name, role, unit_id } = user;
        const { accessToken, refreshToken } = generateTokens({ Emp_id, First_name, Last_name, role, unit_id });
        return { accessToken, refreshToken, role };
    },

    // Used by the refresh endpoint to rebuild a fresh access token payload
    // (role/unit could have changed since the refresh token was issued).
    async getEmployeeById(id) {
        const [users] = await pool.query('SELECT * FROM Employee WHERE Emp_id = ?', [id]);
        if (users.length === 0) {
            throw new Error('User not found');
        }
        return users[0];
    },

    verifyRefreshToken,
    generateTokens,
};

module.exports = authService;