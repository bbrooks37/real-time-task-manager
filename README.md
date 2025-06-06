# Real-time Task Management System

## Project Overview

This is a full-stack, real-time task management application designed to help individuals and teams organize, track, and collaborate on tasks efficiently. It mimics real-world data complexity by handling multi-user interactions, hierarchical tasks (tasks with subtasks), project organization, and real-time updates.

The application is built with a JavaScript frontend, a Node.js/Express.js backend, and uses PostgreSQL for data persistence, incorporating Socket.IO for real-time communication.

## Features

* **User Authentication:** Secure user registration and login.
* **Project Management:** Create, view, update, and delete projects.
* **Task Creation & Management:**
    * Create tasks with titles, descriptions, due dates, priorities, and statuses.
    * Assign tasks to specific users.
    * Link tasks to projects.
    * Support for subtasks, creating a hierarchical task structure.
    * Add tags to tasks for better categorization.
* **Real-time Collaboration:** Instant updates on task changes (creation, completion, assignment) for all active users, powered by WebSockets (Socket.IO).
* **Filtering & Searching:** Efficiently find tasks by project, assignee, status, priority, or through a search query.
* **Intuitive Dashboard:** A centralized view displaying assigned tasks and project overviews.
* **(Optional: If you implement it) Drag-and-Drop:** Visually reorder tasks or move them between status columns.

## Technologies Used

### Frontend (Client)
* **HTML5:** Structure of the web pages.
* **CSS3:** Styling and visual presentation.
* **JavaScript (Vanilla JS):** Core interactivity and logic.
    * *(Consider adding if you used one: React/Vue/other lightweight framework for component-based UI)*
* **Socket.IO Client:** For real-time communication with the backend.
* **(Optional: If you use it) Chart.js / D3.js:** For any potential data visualization.

### Backend (Server)
* **Node.js:** JavaScript runtime environment.
* **Express.js:** Web application framework for Node.js, building RESTful APIs.
* **PostgreSQL:** Robust relational database for data storage.
* **`pg`:** Node.js client for PostgreSQL.
* **Socket.IO:** Library for real-time, bidirectional communication.
* **`bcrypt.js`:** For secure password hashing.
* **`jsonwebtoken` (JWT):** For user authentication and session management.
* **`dotenv`:** For managing environment variables.

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

* Node.js (LTS version recommended)
* npm (comes with Node.js)
* PostgreSQL installed and running
* Git

### 1. Clone the Repository

```bash
git clone [https://github.com/your-username/real-time-task-manager.git](https://github.com/your-username/real-time-task-manager.git)
cd real-time-task-manager
