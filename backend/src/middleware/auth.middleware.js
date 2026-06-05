import jwt from 'jsonwebtoken';
import { invalidatedUsers } from '../utils/sessionCache.js';

const COOKIE_NAME = 'yau_crm_token';
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
};

const auth = (req, res, next) => {
    // 1. Try the httpOnly cookie first (browser sessions)
    let token = req.cookies?.[COOKIE_NAME];
    // 2. Fallback: Authorization header (for scripts / API clients)
    if (!token) {
        token = req.header('Authorization')?.replace('Bearer ', '');
    }

    if (!token) {
        return res.status(401).json({ error: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user session was invalidated
        if (decoded.id && invalidatedUsers.has(decoded.id.toString())) {
            const invalidationTime = invalidatedUsers.get(decoded.id.toString());
            const tokenIssuedTime = (decoded.iat || 0) * 1000;

            if (tokenIssuedTime < invalidationTime) {
                // Clear the session cookie and return 401
                res.cookie(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 });
                return res.status(401).json({ error: 'Your role or account status has changed. Please log in again.' });
            } else {
                // The user logged back in successfully; clear their entry to save memory
                invalidatedUsers.delete(decoded.id.toString());
            }
        }

        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};

export default auth;
