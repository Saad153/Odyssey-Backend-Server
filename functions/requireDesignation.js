// req.user is populated by functions/tokenVerification.js (the global auth
// middleware) from the JWT payload, which already carries `designation`.
module.exports = (allowed) => (req, res, next) => {
    const allowedLower = allowed.map((a) => a.toLowerCase());
    if (!req.user || !allowedLower.includes((req.user.designation || '').toLowerCase())) {
        return res.status(403).json({
            status: 'error',
            result: `This action requires designation: ${allowed.join(' or ')}.`,
        });
    }
    next();
};
