CREATE TABLE `Org_unit` (
  `unit_id` integer PRIMARY KEY,
  `name` varchar2(100) NOT NULL,
  `type` ENUM ('section', 'department', 'direction') NOT NULL,
  `parent_unit_id` integer
);

CREATE TABLE `Employee` (
  `Emp_id` integer PRIMARY KEY,
  `First_name` varchar2(100) NOT NULL,
  `Last_name` varchar2(100) NOT NULL,
  `email` varchar2(150) UNIQUE NOT NULL,
  `password` varchar2(200) NOT NULL,
  `recrutement_date` date NOT NULL,
  `role` ENUM ('employee', 'head', 'hr') NOT NULL,
  `unit_id` integer NOT NULL,
  `forward_drh` bool NOT NULL
);

CREATE TABLE `Attendance` (
  `Emp_id` integer NOT NULL,
  `attendance_date` date NOT NULL,
  `attend` bool NOT NULL,
  PRIMARY KEY (`Emp_id`, `attendance_date`)
);

CREATE TABLE `Exercise` (
  `Emp_id` integer NOT NULL,
  `exercise` varchar2(20) NOT NULL,
  `balance` decimal(5,1) NOT NULL,
  PRIMARY KEY (`Emp_id`, `exercise`)
);

CREATE TABLE `Leave_request` (
  `request_id` integer PRIMARY KEY,
  `Emp_id` integer NOT NULL,
  `exercise` varchar2(20) NOT NULL,
  `leave_type` ENUM ('annual', 'exceptional', 'advance') NOT NULL,
  `start_date` date NOT NULL,
  `duration` int NOT NULL,
  `reason_type` varchar2(50),
  `justification` varchar2(500),
  `url_justification` varchar2(200),
  `request_status` varchar2(200) NOT NULL
);

CREATE TABLE `Request_step` (
  `step_id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `step_order` int NOT NULL,
  `target_id` int NOT NULL,
  `decision` ENUM ('approved', 'rejected'),
  `comment` varchar2(500),
  `decided_at` timestamp NULL,
  PRIMARY KEY (`step_id`),
  UNIQUE KEY `uniq_request_step_order` (`request_id`, `step_order`),
  KEY `idx_request_step_request` (`request_id`),
  KEY `idx_request_step_target` (`target_id`)
);

ALTER TABLE `Org_unit` ADD FOREIGN KEY (`parent_unit_id`) REFERENCES `Org_unit` (`unit_id`);

ALTER TABLE `Employee` ADD FOREIGN KEY (`unit_id`) REFERENCES `Org_unit` (`unit_id`);

ALTER TABLE `Attendance` ADD FOREIGN KEY (`Emp_id`) REFERENCES `Employee` (`Emp_id`);

ALTER TABLE `Exercise` ADD FOREIGN KEY (`Emp_id`) REFERENCES `Employee` (`Emp_id`);

ALTER TABLE `Leave_request` ADD FOREIGN KEY (`Emp_id`) REFERENCES `Employee` (`Emp_id`);

ALTER TABLE `Request_step` ADD FOREIGN KEY (`request_id`) REFERENCES `Leave_request` (`request_id`);

ALTER TABLE `Request_step` ADD FOREIGN KEY (`target_id`) REFERENCES `Employee` (`Emp_id`);

ALTER TABLE `Leave_request` ADD FOREIGN KEY (`Emp_id`, `exercise`) REFERENCES `Exercise` (`Emp_id`, `exercise`);
