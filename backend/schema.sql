-- PostgreSQL schema

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    salary VARCHAR(100),
    description TEXT,
    requirements TEXT,
    employment_type VARCHAR(100),
    application_deadline DATE,
    posted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    contact_email VARCHAR(255),
    category VARCHAR(120) DEFAULT 'Others',
    entry_level BOOLEAN DEFAULT FALSE,
    no_degree_required BOOLEAN DEFAULT FALSE,
    remote_job BOOLEAN DEFAULT FALSE,
    part_time BOOLEAN DEFAULT FALSE,
    high_paying BOOLEAN DEFAULT FALSE,
    fast_hiring BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    resume_link VARCHAR(255),
    qualification_text TEXT,
    document_name VARCHAR(255),
    document_path VARCHAR(255),
    other_document_name VARCHAR(255),
    other_document_path VARCHAR(255),
    full_name VARCHAR(255),
    applicant_email VARCHAR(255),
    phone VARCHAR(100),
    cover_letter TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO jobs (title, company, location, salary, description)
SELECT * FROM (
    VALUES
        ('Software Engineer', 'Tech Corp', 'San Francisco, CA', '$120k-150k', 'Build scalable web applications'),
        ('Product Manager', 'StartupXYZ', 'New York, NY', '$100k-130k', 'Lead product strategy'),
        ('Data Scientist', 'DataWorks', 'Remote', '$110k-140k', 'Analyze and visualize data')
) AS seed(title, company, location, salary, description)
WHERE NOT EXISTS (SELECT 1 FROM jobs);
