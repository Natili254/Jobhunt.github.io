const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "secretkey254";

module.exports = (req, res, next) => {
    const token = req.headers["authorization"];

    if (!token) return res.sendStatus(403);

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.sendStatus(401);
        req.user = decoded;
        next();
    });
};
