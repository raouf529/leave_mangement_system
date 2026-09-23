CREATE TABLE `Direction` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL
);

CREATE TABLE `Departement` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL,
  `direction_id` integer NOT NULL
);

CREATE TABLE `Service` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL,
  `direction_id` integer,
  `departement_id` integer
);

CREATE TABLE `Employe` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL,
  `nom_jeune_fille` varchar(100) NOT NULL,
  `prenom` varchar(150) NOT NULL UNIQUE,
  `password` varchar(200) NOT NULL,
  `email` varchar(200) NOT NULL UNIQUE,
  `date_entree` date NOT NULL,
  `role` ENUM ('admin', 'directeur', 'chef_departement', 'chef_service', 'drh', 'employe') NOT NULL,
  `direction_id` integer,
  `departement_id` integer,
  `service_id` integer,
  `matricule` integer,
  `fonction` varchar(100), 
  `can_create_for_employee` bool NOT NULL DEFAULT false,
  `role_for_leave_request_validation` ENUM ('directeur', 'chef_departement', 'chef_service', 'admin', 'employe') NOT NULL,
  `is_leave_responsible` bool NOT NULL DEFAULT false
);

CREATE TABLE `Exercise` (
  `exercise_id` integer PRIMARY KEY AUTO_INCREMENT,
  `Emp_id` integer NOT NULL,
  `year` int NOT NULL,
  `balance` decimal(5,1) NOT NULL,
  `created_at` date Not NULL,
  UNIQUE KEY `uniq_emp_year` (`Emp_id`, `year`)
);

CREATE TABLE `Leave_request` (
  `request_id` integer PRIMARY KEY AUTO_INCREMENT,
  `Emp_id` integer NOT NULL,
  `created_by` integer,
  `exercise` int NOT NULL,
  `leave_type` ENUM ('annual', 'exceptional', 'advance') NOT NULL,
  `start_date` date NOT NULL,
  `duration` int NOT NULL,
  `reason_type` varchar(50),
  `justification` varchar(500),
  `url_justification` varchar(200),
  `request_status` varchar(200) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `chk_exceptional_requires_reason`
    CHECK (
      (`leave_type` = 'exceptional' AND `reason_type` IS NOT NULL)
      OR (`leave_type` <> 'exceptional')
    )
);

CREATE TABLE `Request_step` (
  `step_id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `step_order` int NOT NULL,
  `target_id` int NOT NULL,
  `decision` ENUM ('approved', 'rejected', 'skipped'),
  `comment` varchar(500),
  `decided_at` timestamp NULL,
  PRIMARY KEY (`step_id`),
  UNIQUE KEY `uniq_request_step_order` (`request_id`, `step_order`),
  KEY `idx_request_step_request` (`request_id`),
  KEY `idx_request_step_target` (`target_id`)
);

CREATE TABLE `Request_exercise_allocation` (
  `allocation_id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `exercise_id` int NOT NULL,
  `days_allocated` decimal(4,1) NOT NULL,
  `remaining_after` DECIMAL(4,1) NULL,
  PRIMARY KEY (`allocation_id`),
  UNIQUE KEY `uniq_request_exercise` (`request_id`, `exercise_id`)
);

CREATE TABLE `Notification` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `target_id` int NOT NULL,
  `request_id` int,
  `content` varchar(500) NOT NULL,
  `is_read` bool NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `idx_notification_target` (`target_id`)
);
create TABLE `Logs` (
  `log_id` INT AUTO_INCREMENT PRIMARY KEY,
  `emp_id` INT,
  `action_type` VARCHAR(50) NOT NULL,
  `action_timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY Key (`log_id`)
);


ALTER TABLE `Departement` ADD FOREIGN KEY (`direction_id`) REFERENCES `Direction` (`id`);
ALTER TABLE `Service` ADD FOREIGN KEY (`direction_id`) REFERENCES `Direction` (`id`);
ALTER TABLE `Service` ADD FOREIGN KEY (`departement_id`) REFERENCES `Departement` (`id`);

ALTER TABLE `Employe` ADD FOREIGN KEY (`direction_id`) REFERENCES `Direction` (`id`);
ALTER TABLE `Employe` ADD FOREIGN KEY (`departement_id`) REFERENCES `Departement` (`id`);
ALTER TABLE `Employe` ADD FOREIGN KEY (`service_id`) REFERENCES `Service` (`id`);

ALTER TABLE `Exercise` ADD FOREIGN KEY (`Emp_id`) REFERENCES `Employe` (`id`);

ALTER TABLE `Leave_request` ADD FOREIGN KEY (`Emp_id`) REFERENCES `Employe` (`id`);
ALTER TABLE `Leave_request` ADD FOREIGN KEY (`created_by`) REFERENCES `Employe` (`id`);
ALTER TABLE `Leave_request` ADD FOREIGN KEY (`Emp_id`, `exercise`) REFERENCES `Exercise` (`Emp_id`, `year`);

ALTER TABLE `Request_step` ADD FOREIGN KEY (`request_id`) REFERENCES `Leave_request` (`request_id`);
ALTER TABLE `Request_step` ADD FOREIGN KEY (`target_id`) REFERENCES `Employe` (`id`);

ALTER TABLE `Request_exercise_allocation` ADD FOREIGN KEY (`request_id`) REFERENCES `Leave_request` (`request_id`);
ALTER TABLE `Request_exercise_allocation` ADD FOREIGN KEY (`exercise_id`) REFERENCES `Exercise` (`exercise_id`);

ALTER TABLE `Notification` ADD FOREIGN KEY (`target_id`) REFERENCES `Employe` (`id`);
ALTER TABLE `Notification` ADD FOREIGN KEY (`request_id`) REFERENCES `Leave_request` (`request_id`);

ALTER TABLE `Logs` ADD FOREIGN KEY (`emp_id`) REFERENCES `Employe` (`id`);