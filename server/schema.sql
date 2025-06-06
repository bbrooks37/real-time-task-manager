--
-- File: schema.sql
-- Description: SQL statements to create all necessary tables for the Real-time Task Management System.
-- Database: PostgreSQL
--

-- Table: users
-- Stores user authentication and profile information.
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: projects
-- Stores information about different projects.
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- If user is deleted, set created_by to NULL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: tasks
-- Stores individual tasks, including details, assignments, and relationships.
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')), -- Enum-like check
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'blocked', 'archived')),
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL, -- If assignee is deleted, set assigned_to to NULL
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, -- If project is deleted, delete associated tasks
    parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE, -- Self-referencing for subtasks
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: tags
-- Stores categories or labels for tasks.
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Junction Table: task_tags
-- Establishes a many-to-many relationship between tasks and tags.
CREATE TABLE task_tags (
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id) -- Composite primary key ensures unique task-tag pairs
);

-- Optional: Index for faster lookups
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Optional: Initial data (you can remove or modify this later)
INSERT INTO users (username, email, password_hash) VALUES
('admin', 'admin@example.com', '$2b$10$w0B0G6F3E6W8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5'), -- Replace with a real hashed password for 'admin'
('john.doe', 'john.doe@example.com', '$2b$10$w0B0G6F3E6W8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5'); -- Replace with a real hashed password for 'john.doe'

INSERT INTO projects (name, description, created_by) VALUES
('Website Redesign', 'Complete overhaul of the company website.', 1),
('Mobile App Development', 'Develop a new cross-platform mobile application.', 2);

INSERT INTO tags (name) VALUES
('Urgent'), ('Bug'), ('Feature'), ('Marketing'), ('Backend'), ('Frontend');