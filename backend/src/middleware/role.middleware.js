import User from '../models/user.model.js';

/**
 * Role-based access control middleware factory.
 *
 * Reads role and isActive directly from the JWT payload (set at login) —
 * NO database call on every request.
 *
 * Usage:
 *   requireRole('admin')                               → only admin
 *   requireRole('admin', 'manager')                    → admin OR manager
 *   requireRole('admin', 'manager', 'sales_rep')       → everyone except view_only
 *   requireRole('admin', 'manager', 'sales_rep', 'view_only') → any authenticated user
 *
 * Attaches req.currentUserRole for downstream controllers.
 */
const requireRole = (...roles) => async (req, res, next) => {
    // auth.middleware.js already verified the JWT and attached req.user
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    // Role and isActive are embedded in the JWT payload at login
    let { role, isActive } = req.user;

    // Fallback for old tokens that do not contain role/isActive claims in their payload
    if (role === undefined || isActive === undefined) {
        try {
            const dbUser = await User.findById(req.user.id).select('role isActive');
            if (dbUser) {
                role = dbUser.role;
                isActive = dbUser.isActive;
                // Attach to req.user for downstream usage
                req.user.role = role;
                req.user.isActive = isActive;
            }
        } catch (err) {
            console.error('Error fetching fallback user role in role middleware:', err);
        }
    }

    if (isActive === false) {
        return res.status(403).json({
            error: 'Your account has been deactivated. Please contact an administrator.'
        });
    }

    // Default to 'view_only' if role is missing or unrecognised (e.g. old tokens)
    const userRole = role || 'view_only';

    if (!roles.includes(userRole)) {
        return res.status(403).json({
            error: `Access denied. Required role: ${roles.join(' or ')}.`
        });
    }

    // Attach for controllers to use without extra lookup
    req.currentUserRole = userRole;

    next();
};

export default requireRole;
