module.exports = function requireRole(role) {
	return (req, res, next) => {
		if (req.user?.role !== role) {
			return res.status(403).json({ error: "Acesso não autorizado" });
		}
		return next();
	};
};
