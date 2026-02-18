-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    salary VARCHAR(100),
    description TEXT,
    requirements TEXT,
    employment_type VARCHAR(100),
    application_deadline DATE,
    posted_by INT,
    contact_email VARCHAR(255),
    category VARCHAR(120) DEFAULT 'Others',
    entry_level TINYINT(1) DEFAULT 0,
    no_degree_required TINYINT(1) DEFAULT 0,
    remote_job TINYINT(1) DEFAULT 0,
    part_time TINYINT(1) DEFAULT 0,
    high_paying TINYINT(1) DEFAULT 0,
    fast_hiring TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    job_id INT NOT NULL,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Insert sample jobs
INSERT INTO jobs (title, company, location, salary, description) VALUES
('Software Engineer', 'Tech Corp', 'San Francisco, CA', '$120k-150k', 'Build scalable web applications'),
('Product Manager', 'StartupXYZ', 'New York, NY', '$100k-130k', 'Lead product strategy'),
('Data Scientist', 'DataWorks', 'Remote', '$110k-140k', 'Analyze and visualize data');
