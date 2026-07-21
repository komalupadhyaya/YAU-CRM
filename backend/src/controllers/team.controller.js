import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import { sendNewMemberEmails, sendDeactivationEmail, sendReactivationEmail, sendDeletionEmail } from '../services/mailer.js';
import { invalidatedUsers } from '../utils/sessionCache.js';




/**
 * GET /api/team
 * Returns a list of all users with safe fields (no password).
 */
export const getUsers = async (req, res, next) => {
    try {
        const users = await User.find({}, 'username name email role isActive phone createdAt')
            .sort({ createdAt: -1 });

        const safeUsers = users.map(u => {
            const obj = u.toObject();
            if (!obj.role) obj.role = 'user';
            if (obj.isActive === undefined) obj.isActive = true;
            return obj;
        });

        res.json(safeUsers);
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/team
 * Create a new internal team user.
 * Body: { name, email, password, role }
 */
export const createUser = async (req, res, next) => {
    try {
        const { name, email, password, role, phone } = req.body;

        if (!email || !password) {
            res.status(400);
            throw new Error('Email and password are required.');
        }

        // Check if username already exists
        const existing = await User.findOne({ username: email });
        if (existing) {
            res.status(409);
            throw new Error('A user with this email already exists.');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            username: email,
            email,
            name: name || email,
            password: hashedPassword,
            role: role || 'sales_rep',
            phone: phone || '',
            isActive: true
        });

        // Send notification emails (non-blocking — errors are logged, not thrown)
        sendNewMemberEmails({
            name: user.name,
            email: user.email,
            role: user.role,
            password, // raw password, before hashing
            createdAt: user.createdAt,
        });

        res.status(201).json({
            _id: user._id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone || '',
            isActive: user.isActive,
            createdAt: user.createdAt
        });
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/team/:id
 * Update a user's name, email, role, and optionally reset password.
 * Body: { name, email, role, password? }
 */
export const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, email, role, password, phone } = req.body;

        const user = await User.findById(id);
        if (!user) {
            res.status(404);
            throw new Error('User not found.');
        }

        // If email is being changed, reject the request as email modification is forbidden after creation
        if (email && email !== user.email) {
            res.status(400);
            throw new Error('Email address cannot be modified once a team member is created.');
        }

        if (name !== undefined) user.name = name;
        if (role !== undefined) user.role = role;
        if (phone !== undefined) user.phone = phone;

        if (password && password.trim().length > 0) {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();

        // Invalidate session cache
        invalidatedUsers.set(id.toString(), Date.now());

        res.json({
            _id: user._id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone || '',
            isActive: user.isActive,
            createdAt: user.createdAt
        });
    } catch (err) {
        next(err);
    }
};

/**
 * PATCH /api/team/:id/toggle
 * Toggle the isActive status of a user.
 * Sends a deactivation email (fire-and-forget) when account is set to inactive.
 */
export const toggleActive = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) {
            res.status(404);
            throw new Error('User not found.');
        }

        user.isActive = !user.isActive;
        await user.save();

        // Invalidate session cache
        invalidatedUsers.set(id.toString(), Date.now());

        // ── Deactivation/Reactivation emails — fire-and-forget (no await) ───
        // The HTTP response is sent immediately below. This runs in the
        // background — any Gmail API errors are caught inside the mailer functions
        // and logged to console. They NEVER block or crash this request.
        if (!user.isActive) {
            sendDeactivationEmail({
                name: user.name || user.username,
                email: user.email || user.username,
                role: user.role,
                deactivatedBy: process.env.ADMIN_EMAIL || 'your administrator',
            });
        } else {
            sendReactivationEmail({
                name: user.name || user.username,
                email: user.email || user.username,
                role: user.role,
                activatedBy: process.env.ADMIN_EMAIL || 'your administrator',
            });
        }

        res.json({ _id: user._id, isActive: user.isActive });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/team/:id
 * Permanently delete a user.
 */
export const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            res.status(404);
            throw new Error('User not found.');
        }

        // Invalidate session cache
        invalidatedUsers.set(id.toString(), Date.now());

        // ── Deletion email — fire-and-forget (no await) ───────────────────
        sendDeletionEmail({
            name: user.name || user.username,
            email: user.email || user.username,
            role: user.role,
            deletedBy: process.env.ADMIN_EMAIL || 'your administrator',
        });

        res.json({ message: 'User deleted successfully.' });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/team/:id/zoom-invite
 * Check if a team member exists in Zoom User Management and send an invitation if not.
 */
export const inviteToZoom = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) {
            res.status(404);
            throw new Error('User not found.');
        }

        const nameParts = (user.name || '').trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { inviteZoomUser } = await import('../services/zoom.service.js');
        const result = await inviteZoomUser(user.email, firstName, lastName);

        res.json(result);
    } catch (err) {
        next(err);
    }
};

