# Leave Management System

## Purpose

This application helps an organization manage employee leave balances and leave requests. Employees can submit and track requests, designated managers can review requests through an approval workflow, and HR or administrators can manage employee records and leave exercises.

## Main Capabilities

- **Employee self-service:** Sign in, view profile and leave balances, review request history, filter requests, create leave requests, and cancel eligible requests.
- **Leave requests:** Supports annual, exceptional, and advance leave. Requests include dates and duration; exceptional leave requires a reason, and supporting documents can be uploaded for exceptional or advance leave.
- **Approval workflow:** Requests are assigned approval steps. Approvers can review pending items and approve or reject them with a comment. The DG has a separate inbox for director requests.
- **Leave accounting:** Balances are tracked by employee and exercise year. The server includes scheduled balance accrual and exercise creation jobs, and requests can allocate days across exercises.
- **Employee and organization administration:** HR and administrators can create employees and exercises, manage balances and request steps, assign selected permissions, and review system logs. Organization data includes directions, departments, and services.
- **Notifications and documents:** In-app notifications can be read or marked as read. Request justifications and approved leave-title documents can be retrieved through authenticated endpoints.
- **Access control:** The backend uses authenticated sessions and role/access checks on protected API operations.

## Technology and Structure

- **Frontend:** React 19, React Router, Vite, and Bootstrap.
- **Backend:** Node.js, Express, and MySQL.
- **Database:** Employee and organization records, exercises, leave requests, approval steps, exercise allocations, notifications, and logs.
- **Deployment:** Docker Compose describes the MySQL database, API server, and frontend services.
- **Tests:** The server includes focused tests for authorization, approval, exercise lifecycle, request duration, and annual leave allocation.

## Possible Gaps and Follow-up Candidates

These are items to evaluate with stakeholders; the repository does not define a complete product requirements list, so they are not necessarily defects.

- **Account recovery:** A dedicated forgotten-password and password-change workflow was not identified; the current sign-in flow is email and password based.
- **External notifications:** In-app notifications exist, but no email or SMS notification integration was identified. Decide whether users need reminders or approval updates outside the application.
- **Team leave planning:** The employee form checks overlap with that employee's approved leave. A shared team calendar or staffing/coverage view may still be useful if managers need to spot team-wide conflicts.
- **Reporting and export:** Administration includes system logs and employee/request management. Confirm whether HR also needs downloadable reports for balances, absences, approvals, or audit periods.
- **Automated test execution:** Server test files are present, but `server/package.json` still has a placeholder `test` script. Add a working test command and CI execution; the client currently exposes build and lint scripts but no test script.
- **Deployment configuration:** Review environment-specific CORS and move deployment secrets out of the Compose file into managed environment configuration before production use.
- **Operational documentation:** Add a deployment/runbook covering required environment variables, database initialization and backups, scheduled jobs, and recovery procedures.

## Suggested Next Step

Confirm the organization’s required workflows and policies (approval sequence, balance rules, notification channels, and reporting needs), then prioritize the candidates above against those requirements.