const path = require("path");
const os = require("os");
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });
const express = require("express");
const cors = require("cors");
const db = require("./db");

const authRoutes = require("./routes/auth");
const jobsRoutes = require("./routes/jobs");

const app = express();

app.use(cors({
    origin: "*",
    credentials: true
}));
app.use(express.json({ limit: "15mb" }));

const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (req, res) => {
    const status = { server: "ok" };
    db.getConnection((err, connection) => {
        if (err) {
            status.db = "down";
            status.error = err.message;
            return res.status(200).json(status);
        }
        connection.query("SELECT 1", (qErr) => {
            if (qErr) {
                status.db = "down";
                status.error = qErr.message;
            } else {
                status.db = "connected";
            }
            connection.release();
            res.status(200).json(status);
        });
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobsRoutes);

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendDir, "index.html"));
});

app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
    console.error("Error:", err.stack);
    res.status(500).json({ message: "Something went wrong!" });
});

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
    const lanIp = Object.values(os.networkInterfaces())
        .flat()
        .find((i) => i && i.family === "IPv4" && !i.internal)?.address;
    console.log(`Server running on port ${PORT}`);
    console.log(`API Base URL: http://localhost:${PORT}`);
    if (lanIp) {
        console.log(`LAN URL: http://${lanIp}:${PORT}`);
    }
    console.log(`Test Jobs: http://localhost:${PORT}/api/jobs`);
    console.log(`Test Health: http://localhost:${PORT}/health`);
});
