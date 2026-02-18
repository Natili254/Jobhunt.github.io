const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const auth = require("../authMiddleware");
let nodemailer = null;
try {
    nodemailer = require("nodemailer");
} catch (err) {
    nodemailer = null;
}

const router = express.Router();
const uploadsDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

function isJobSeekerRole(role) {
    return role === "jobseeker" || role === "user";
}

function statusToLabel(status) {
    if (status === "pending") return "Not Yet Reviewed";
    if (status === "shortlisted") return "Shortlisted";
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    return status;
}

let cachedTransporter = null;

function getMailTransporter() {
    if (!nodemailer) return null;
    if (cachedTransporter) return cachedTransporter;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) return null;

    cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465,
        auth: { user, pass }
    });
    return cachedTransporter;
}

async function sendApplicationStatusEmail({ applicantEmail, fullName, jobTitle, company, status }) {
    const transporter = getMailTransporter();
    if (!transporter || !applicantEmail) return false;

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const statusLabel = statusToLabel(status);
    const name = fullName || "Applicant";
    const subjectPrefix = status === "approved" ? "Application Approved" : status === "rejected" ? "Application Update" : "Application Progress Update";
    const subject = `${subjectPrefix}: ${jobTitle} at ${company}`;

    let body;
    if (status === "approved") {
        body = `Hello ${name},\n\nCongratulations. Your application for ${jobTitle} at ${company} has been approved.\n\nWe will contact you soon with next steps.\n\nRegards,\n${company}`;
    } else if (status === "rejected") {
        body = `Hello ${name},\n\nThank you for your interest in ${jobTitle} at ${company}. After careful review, we will not be moving forward at this time.\n\nWe appreciate your effort and encourage you to apply to future opportunities.\n\nRegards,\n${company}`;
    } else if (status === "shortlisted") {
        body = `Hello ${name},\n\nGood news. Your application for ${jobTitle} at ${company} has been shortlisted.\n\nWe will reach out with the next steps.\n\nRegards,\n${company}`;
    } else {
        body = `Hello ${name},\n\nYour application status for ${jobTitle} at ${company} is now: ${statusLabel}.\n\nRegards,\n${company}`;
    }

    await transporter.sendMail({
        from,
        to: applicantEmail,
        subject,
        text: body
    });
    return true;
}

async function sendDirectEmployerEmail({ applicantEmail, fullName, jobTitle, company, subject, message }) {
    const transporter = getMailTransporter();
    if (!transporter || !applicantEmail) return false;

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const name = fullName || "Applicant";
    const safeSubject = (subject || "").trim() || `Update on your application: ${jobTitle} at ${company}`;
    const safeMessage = (message || "").trim();

    const textBody = [
        `Hello ${name},`,
        "",
        safeMessage || `You have an update regarding your application for ${jobTitle} at ${company}.`,
        "",
        "Regards,",
        company
    ].join("\n");

    await transporter.sendMail({
        from,
        to: applicantEmail,
        subject: safeSubject,
        text: textBody
    });
    return true;
}

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

async function addColumnIfMissing(table, column, definition) {
    const exists = await runQuery(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
    if (exists.length === 0) {
        await runQuery(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

async function ensureSchema() {
    await addColumnIfMissing("jobs", "requirements", "TEXT NULL");
    await addColumnIfMissing("jobs", "employment_type", "VARCHAR(100) NULL");
    await addColumnIfMissing("jobs", "application_deadline", "DATE NULL");
    await addColumnIfMissing("jobs", "posted_by", "INT NULL");
    await addColumnIfMissing("jobs", "contact_email", "VARCHAR(255) NULL");
    await addColumnIfMissing("jobs", "category", "VARCHAR(120) DEFAULT 'Others'");
    await addColumnIfMissing("jobs", "entry_level", "TINYINT(1) DEFAULT 0");
    await addColumnIfMissing("jobs", "no_degree_required", "TINYINT(1) DEFAULT 0");
    await addColumnIfMissing("jobs", "remote_job", "TINYINT(1) DEFAULT 0");
    await addColumnIfMissing("jobs", "part_time", "TINYINT(1) DEFAULT 0");
    await addColumnIfMissing("jobs", "high_paying", "TINYINT(1) DEFAULT 0");
    await addColumnIfMissing("jobs", "fast_hiring", "TINYINT(1) DEFAULT 0");
    await addColumnIfMissing("jobs", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

    await addColumnIfMissing("applications", "qualification_text", "TEXT NULL");
    await addColumnIfMissing("applications", "document_name", "VARCHAR(255) NULL");
    await addColumnIfMissing("applications", "document_path", "VARCHAR(255) NULL");
    await addColumnIfMissing("applications", "full_name", "VARCHAR(255) NULL");
    await addColumnIfMissing("applications", "applicant_email", "VARCHAR(255) NULL");
    await addColumnIfMissing("applications", "phone", "VARCHAR(100) NULL");
    await addColumnIfMissing("applications", "cover_letter", "TEXT NULL");
    await addColumnIfMissing("applications", "other_document_name", "VARCHAR(255) NULL");
    await addColumnIfMissing("applications", "other_document_path", "VARCHAR(255) NULL");
    await addColumnIfMissing("applications", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
}

const migrationPromise = ensureSchema().catch((err) => {
    console.error("Schema migration warning:", err.message);
});

router.get("/", async (req, res) => {
    try {
        await migrationPromise;
        const jobs = await runQuery(
            `SELECT id, title, company, location, salary, description, requirements,
                    employment_type, application_deadline, posted_by, contact_email, category,
                    entry_level, no_degree_required, remote_job, part_time, high_paying, fast_hiring, created_at
             FROM jobs
             ORDER BY id DESC`
        );
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch jobs", error: err.message });
    }
});

router.post("/", auth, async (req, res) => {
    if (req.user.role !== "employer") {
        return res.status(403).json({ message: "Only employers can post jobs" });
    }

    const {
        title,
        company,
        location,
        salary,
        description,
        requirements,
        employmentType,
        applicationDeadline,
        contactEmail,
        category,
        tags
    } = req.body;

    if (!title || !company || !location || !description) {
        return res.status(400).json({ message: "title, company, location, and description are required" });
    }

    const normalizedCategory = String(category || "Others").trim() || "Others";
    const normalizedTags = {
        entryLevel: Boolean(tags?.entryLevel),
        noDegreeRequired: Boolean(tags?.noDegreeRequired),
        remoteJobs: Boolean(tags?.remoteJobs),
        partTime: Boolean(tags?.partTime),
        highPaying: Boolean(tags?.highPaying),
        fastHiring: Boolean(tags?.fastHiring)
    };

    try {
        await migrationPromise;
        const result = await runQuery(
            `INSERT INTO jobs
                (title, company, location, salary, description, requirements, employment_type, application_deadline, posted_by, contact_email, category, entry_level, no_degree_required, remote_job, part_time, high_paying, fast_hiring)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title,
                company,
                location,
                salary || null,
                description,
                requirements || null,
                employmentType || null,
                applicationDeadline || null,
                req.user.id,
                contactEmail || null,
                normalizedCategory,
                normalizedTags.entryLevel ? 1 : 0,
                normalizedTags.noDegreeRequired ? 1 : 0,
                normalizedTags.remoteJobs ? 1 : 0,
                normalizedTags.partTime ? 1 : 0,
                normalizedTags.highPaying ? 1 : 0,
                normalizedTags.fastHiring ? 1 : 0
            ]
        );

        res.status(201).json({
            message: "Job posted successfully",
            jobId: result.insertId
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to post job", error: err.message });
    }
});

router.get("/applied/me", auth, async (req, res) => {
    if (!isJobSeekerRole(req.user.role)) {
        return res.status(200).json({ appliedJobIds: [] });
    }

    try {
        await migrationPromise;
        const rows = await runQuery("SELECT job_id FROM applications WHERE user_id = ?", [req.user.id]);
        res.json({ appliedJobIds: rows.map((r) => r.job_id) });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch applications", error: err.message });
    }
});

router.get("/applications/me", auth, async (req, res) => {
    if (!isJobSeekerRole(req.user.role)) {
        return res.status(200).json({ applications: [] });
    }

    try {
        await migrationPromise;
        const rows = await runQuery(
            `SELECT
                a.id AS application_id,
                a.job_id,
                a.status,
                a.created_at,
                j.title AS job_title,
                j.company,
                j.location,
                j.salary
             FROM applications a
             INNER JOIN jobs j ON j.id = a.job_id
             WHERE a.user_id = ?
             ORDER BY a.id DESC`,
            [req.user.id]
        );
        res.json({ applications: rows });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch your applications", error: err.message });
    }
});

router.post("/:id/apply", auth, async (req, res) => {
    if (!isJobSeekerRole(req.user.role)) {
        return res.status(403).json({ message: "Only job seekers can apply to jobs" });
    }

    const jobId = Number(req.params.id);
    if (!Number.isInteger(jobId) || jobId <= 0) {
        return res.status(400).json({ message: "Invalid job id" });
    }

    const {
        fullName,
        applicantEmail,
        phone,
        coverLetter,
        qualificationText,
        documentName,
        documentData,
        resumeDocumentName,
        resumeDocumentData,
        otherDocumentName,
        otherDocumentData
    } = req.body;

    if (!fullName || !applicantEmail || !qualificationText) {
        return res.status(400).json({ message: "Name, email, and qualification details are required" });
    }

    try {
        await migrationPromise;

        const jobs = await runQuery("SELECT id FROM jobs WHERE id = ?", [jobId]);
        if (jobs.length === 0) {
            return res.status(404).json({ message: "Job not found" });
        }

        const existing = await runQuery(
            "SELECT id FROM applications WHERE user_id = ? AND job_id = ? LIMIT 1",
            [req.user.id, jobId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: "You already applied for this job" });
        }

        function persistUpload(rawName, rawData, suffix) {
            if (!rawName || !rawData) return { safeName: null, savedPath: null };
            const safeName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, "_");
            const payload = rawData.includes(",") ? rawData.split(",")[1] : rawData;
            const buffer = Buffer.from(payload, "base64");
            const fileName = `${Date.now()}_${req.user.id}_${jobId}_${suffix}_${safeName}`;
            const outPath = path.join(uploadsDir, fileName);
            fs.writeFileSync(outPath, buffer);
            return { safeName, savedPath: `/uploads/${fileName}` };
        }

        const resumeUpload = persistUpload(
            resumeDocumentName || documentName,
            resumeDocumentData || documentData,
            "resume"
        );
        const otherUpload = persistUpload(otherDocumentName, otherDocumentData, "other");

        const result = await runQuery(
            `INSERT INTO applications
                (user_id, job_id, resume_link, qualification_text, document_name, document_path, full_name, applicant_email, phone, cover_letter, other_document_name, other_document_path, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                req.user.id,
                jobId,
                resumeUpload.savedPath,
                qualificationText,
                resumeUpload.safeName,
                resumeUpload.savedPath,
                fullName,
                applicantEmail,
                phone || null,
                coverLetter || null,
                otherUpload.safeName,
                otherUpload.savedPath
            ]
        );

        res.status(201).json({
            message: "Application submitted successfully",
            applicationId: result.insertId
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to apply for job", error: err.message });
    }
});

router.get("/employer/applications", auth, async (req, res) => {
    if (req.user.role !== "employer") {
        return res.status(403).json({ message: "Only employers can review applications" });
    }

    try {
        await migrationPromise;
        const rows = await runQuery(
            `SELECT
                a.id AS application_id,
                a.job_id,
                a.full_name,
                a.applicant_email,
                a.phone,
                a.cover_letter,
                a.qualification_text,
                a.document_name,
                a.document_path,
                a.other_document_name,
                a.other_document_path,
                a.status,
                a.created_at,
                j.title AS job_title,
                j.company,
                j.posted_by
             FROM applications a
             INNER JOIN jobs j ON j.id = a.job_id
             WHERE j.posted_by = ?
             ORDER BY a.id DESC`,
            [req.user.id]
        );

        res.json({ applications: rows });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch employer applications", error: err.message });
    }
});

router.patch("/employer/applications/:applicationId/status", auth, async (req, res) => {
    if (req.user.role !== "employer") {
        return res.status(403).json({ message: "Only employers can update application status" });
    }

    const applicationId = Number(req.params.applicationId);
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
        return res.status(400).json({ message: "Invalid application id" });
    }

    const rawStatus = String(req.body?.status || "").toLowerCase().trim();
    const allowedStatuses = ["pending", "shortlisted", "approved", "rejected"];
    if (!allowedStatuses.includes(rawStatus)) {
        return res.status(400).json({ message: "Status must be pending, shortlisted, approved, or rejected" });
    }

    try {
        await migrationPromise;

        const ownerRows = await runQuery(
            `SELECT
                a.id,
                a.applicant_email,
                a.full_name,
                j.title AS job_title,
                j.company
             FROM applications a
             INNER JOIN jobs j ON j.id = a.job_id
             WHERE a.id = ? AND j.posted_by = ?
             LIMIT 1`,
            [applicationId, req.user.id]
        );

        if (ownerRows.length === 0) {
            return res.status(404).json({ message: "Application not found for this employer" });
        }

        await runQuery("UPDATE applications SET status = ? WHERE id = ?", [rawStatus, applicationId]);

        const applicant = ownerRows[0];
        try {
            await sendApplicationStatusEmail({
                applicantEmail: applicant.applicant_email,
                fullName: applicant.full_name,
                jobTitle: applicant.job_title,
                company: applicant.company,
                status: rawStatus
            });
        } catch (emailErr) {
            console.error("Status email warning:", emailErr.message);
        }

        res.json({ message: "Application status updated", status: rawStatus });
    } catch (err) {
        res.status(500).json({ message: "Failed to update application status", error: err.message });
    }
});

router.post("/employer/applications/:applicationId/email", auth, async (req, res) => {
    if (req.user.role !== "employer") {
        return res.status(403).json({ message: "Only employers can send applicant emails" });
    }

    const applicationId = Number(req.params.applicationId);
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
        return res.status(400).json({ message: "Invalid application id" });
    }

    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();
    if (!message) {
        return res.status(400).json({ message: "Email message is required" });
    }

    try {
        await migrationPromise;

        const rows = await runQuery(
            `SELECT
                a.id,
                a.status,
                a.applicant_email,
                a.full_name,
                j.title AS job_title,
                j.company
             FROM applications a
             INNER JOIN jobs j ON j.id = a.job_id
             WHERE a.id = ? AND j.posted_by = ?
             LIMIT 1`,
            [applicationId, req.user.id]
        );

        if (!rows.length) {
            return res.status(404).json({ message: "Application not found for this employer" });
        }

        const application = rows[0];
        if (!["approved", "shortlisted"].includes(application.status)) {
            return res.status(400).json({ message: "You can email only approved or shortlisted applicants" });
        }

        const sent = await sendDirectEmployerEmail({
            applicantEmail: application.applicant_email,
            fullName: application.full_name,
            jobTitle: application.job_title,
            company: application.company,
            subject,
            message
        });

        if (!sent) {
            return res.status(500).json({ message: "Email service is not configured. Set SMTP environment variables." });
        }

        res.json({ message: "Email sent successfully" });
    } catch (err) {
        res.status(500).json({ message: "Failed to send email", error: err.message });
    }
});

module.exports = router;
