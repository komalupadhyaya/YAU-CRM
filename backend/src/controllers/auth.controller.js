import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

// ── Cookie config shared by login & logout ─────────────────────────────────
const COOKIE_NAME = 'yau_crm_token';
const COOKIE_OPTIONS = {
    httpOnly: true,       // JS in the browser CANNOT read this cookie — XSS protection
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'lax',      // Sent on same-site navigations, blocked on cross-site POST
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days in milliseconds
    path: '/',
};

export const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        console.log(username, password);
        const user = await User.findOne({ username });
        if (!user) {
            res.status(401);
            throw new Error('Invalid credentials');
        }

        if (user.isActive === false) {
            res.status(403);
            throw new Error('This account has been deactivated. Please contact your administrator.');
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            res.status(401);
            throw new Error('Invalid credentials');
        }

        // Sign JWT — include role and isActive so role middleware doesn't need a DB call
        const token = jwt.sign(
            { id: user._id, role: user.role, isActive: user.isActive },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Set as an httpOnly cookie — browser stores it, JS cannot touch it
        res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        // Return minimal user info (no token in body — it's in the cookie now)
        res.json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err) {
        next(err);
    }
};

export const logout = (req, res) => {
    // Clear the cookie by setting maxAge to 0
    res.cookie(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 });
    res.json({ success: true, message: 'Logged out successfully' });
};

export const getCurrentUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id, '-password');
        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }
        res.json(user);
    } catch (err) {
        next(err);
    }
};
