# Leave Management System

A full-stack leave management application designed for employee leave requests, approval workflows, leave balance management, and administrative oversight.

## Overview

This project helps organizations manage employee leave from request to approval. Employees can submit leave requests, attach justification files when needed, and track the status of their requests. Managers and administrators can review, approve, reject, or reassign requests based on departmental roles and approval steps.

The system also includes year-based leave accounting, automatic monthly exercise processing, notifications, and administrative employee management.

## Features

- Employee registration and authentication
- Role-based access for employees, managers, and administrators
- Leave request creation with type, duration, and justification support
- Multi-step approval workflow with role-based routing
- Leave balance tracking by exercise/year
- Manual and automatic leave exercise creation
- Administrative employee management and role assignment
- Notification and email alerts for approvals and status updates
- Monthly background job for exercise maintenance
- Dockerized setup for easy local deployment

## Tech Stack

- Frontend: React, Vite, Bootstrap, React Router
- Backend: Node.js, Express
- Database: MySQL
- Email: Nodemailer
- Containerization: Docker and Docker Compose

## Project Structure

```text
leave_mangement_system/
├── client/                     # React frontend
│   ├── src/                   # Application pages and components
│   ├── public/                # Static assets
│   ├── Dockerfile             # Frontend container configuration
│   ├── package.json           # Frontend dependencies and scripts
│   └── vite.config.js        # Vite configuration
├── server/                    # Express backend
│   ├── controllers/           # Request handlers
│   ├── middleware/            # Auth and request middleware
│   ├── routes/                # API route definitions
│   ├── services/              # Business logic and background jobs
│   ├── utils/                 # Helper utilities
│   ├── tests/                 # Backend tests for leave workflows
│   ├── uploads/               # Uploaded justification files
│   ├── db.js                  # Database connection
│   ├── server.js              # App entry point
│   ├── Dockerfile             # Backend container configuration
│   └── package.json           # Backend dependencies and scripts
├── docker-compose.yaml        # Full application orchestration
├── Leave_mangement_system.sql # Database schema and seed script
├── README.md                  # Project documentation
```

## Roles and Workflow

The application is designed around a company hierarchy and approval chain:

- Employee: submit leave requests
- Team/Service head: validate requests in their unit
- Department lead: review and approve requests
- DRH / HR management: manage leave and policy-level approvals
- Administrator: manage employees, exercises, and overall system settings

Requests can be forwarded, updated, or rejected depending on the configured approval path.

## Requirements

Before running the project, make sure the following are installed:

- Node.js 18+
- npm
- Docker Desktop or Docker Engine
- Docker Compose

## Quick Start with Docker

1. Clone the repository:

```bash
git clone <repository-url>
cd leave_mangement_system
```

2. Start all services:

```bash
docker compose up --build
```

3. Access the application:

- Frontend: http://localhost
- Backend API: http://localhost:5000
- MySQL database: available through the Docker service named `db`

The Docker setup automatically initializes the database using `Leave_mangement_system.sql`.

## Environment Variables

The backend container uses the following environment values in `docker-compose.yaml`:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `MAIL_FROM`
- `APP_BASE_URL`

If you want email notifications to work, configure the SMTP variables before running the Docker stack.

## Local Development

### Backend

```bash
cd server
npm install
node server.js
```

The backend runs on port `5000` by default.

### Frontend

```bash
cd client
npm install
npm run dev
```

The frontend runs with Vite and is usually available at:

- http://localhost:5173

## API Notes

The API is organized under `/api` with routes such as:

- `/api/auth` - login, registration, refresh token, logout
- `/api/profile` - employee profile access
- `/api/request` - leave request operations
- `/api/notification` - notification retrieval and updates
- `/api/exercise` - leave year management
- `/api/admin` - administrative controls
- `/api/employe` - employee management

## Database

The database schema is imported from `Leave_mangement_system.sql` and includes the tables required for employees, leave requests, approval steps, leave exercises, and notifications.

## Notes

- The system is configured for a company environment with French labels and role naming in several modules.
- Background cron jobs handle scheduled leave exercise updates.
- Uploaded justification files are stored under `server/uploads/justifications/`.
- added attribute in Employe table are: 
    - `role_leave_validationto` not confuse with role, it don't have drh so drh workers will be assigned as others, 
    - `can_create_for_employee`: boolean represent who can create leave request for other employee, if true the employee can create leave request for other employee, if false the employee can only create leave request for himself/herself.
    - `is_leave_responsible`: boolean represent who is responsible for leave management, if true the employee can manage leave request for other employee: create 'titre de canger', validate advanced leaves, create leave for others, if false the employee can't manage leave request for other employee.
- the create user interface is only for test, assuming that there is other system to manage employee creation and role assignment, so the create user interface is not for production use.
## License

This project is for internal enterprise use and is distributed under the project’s current licensing terms.
