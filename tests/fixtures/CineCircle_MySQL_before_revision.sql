CREATE DATABASE cinecircle
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE cinecircle;

CREATE TABLE `users` (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  register_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB;

CREATE TABLE `user_email` (
  user_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(254) NOT NULL,
  PRIMARY KEY (user_id, email),
  CONSTRAINT `fk_email_user` FOREIGN KEY (user_id) REFERENCES `users` (user_id)
) ENGINE=InnoDB;

CREATE TABLE `regular_user` (
  user_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT `fk_regular_user_user` FOREIGN KEY (user_id) REFERENCES `users` (user_id)
) ENGINE=InnoDB;

CREATE TABLE `premium_user` (
  user_id BIGINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  discount_rate DECIMAL(5,4) NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT `fk_premium_user_user` FOREIGN KEY (user_id) REFERENCES `users` (user_id),
  CONSTRAINT `chk_premium_dates` CHECK (expiry_date >= start_date),
  CONSTRAINT `chk_premium_rate` CHECK (discount_rate BETWEEN 0 AND 1)
) ENGINE=InnoDB;

CREATE TABLE `movie` (
  movie_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  duration SMALLINT UNSIGNED NOT NULL,
  release_date DATE NULL,
  language VARCHAR(100) NOT NULL,
  PRIMARY KEY (movie_id),
  CONSTRAINT `chk_movie_duration` CHECK (duration > 0)
) ENGINE=InnoDB;

CREATE TABLE `genre` (
  genre_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  genre_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (genre_id)
) ENGINE=InnoDB;

CREATE TABLE `movie_genre` (
  movie_id BIGINT UNSIGNED NOT NULL,
  genre_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (movie_id, genre_id),
  CONSTRAINT `fk_mg_movie` FOREIGN KEY (movie_id) REFERENCES `movie` (movie_id),
  CONSTRAINT `fk_mg_genre` FOREIGN KEY (genre_id) REFERENCES `genre` (genre_id)
) ENGINE=InnoDB;

CREATE TABLE `film_list` (
  user_id BIGINT UNSIGNED NOT NULL,
  list_id BIGINT UNSIGNED NOT NULL,
  list_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'private',
  create_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, list_id),
  CONSTRAINT `fk_list_owner` FOREIGN KEY (user_id) REFERENCES `users` (user_id),
  CONSTRAINT `chk_list_visibility` CHECK (visibility IN ('public', 'private'))
) ENGINE=InnoDB;

CREATE TABLE `film_list_movie` (
  user_id BIGINT UNSIGNED NOT NULL,
  list_id BIGINT UNSIGNED NOT NULL,
  movie_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, list_id, movie_id),
  CONSTRAINT `fk_flm_list` FOREIGN KEY (user_id, list_id) REFERENCES `film_list` (user_id, list_id),
  CONSTRAINT `fk_flm_movie` FOREIGN KEY (movie_id) REFERENCES `movie` (movie_id),
  CONSTRAINT `chk_list_position` CHECK (position > 0)
) ENGINE=InnoDB;

CREATE TABLE `review` (
  review_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  movie_id BIGINT UNSIGNED NOT NULL,
  review_text TEXT NULL,
  rating DECIMAL(3,1) NOT NULL,
  create_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id),
  CONSTRAINT `fk_review_author` FOREIGN KEY (user_id) REFERENCES `users` (user_id),
  CONSTRAINT `fk_review_movie` FOREIGN KEY (movie_id) REFERENCES `movie` (movie_id),
  CONSTRAINT `chk_review_rating` CHECK (rating BETWEEN 0 AND 10)
) ENGINE=InnoDB;

CREATE TABLE `follows` (
  follower_id BIGINT UNSIGNED NOT NULL,
  followed_id BIGINT UNSIGNED NOT NULL,
  follow_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT `fk_follows_follower` FOREIGN KEY (follower_id) REFERENCES `users` (user_id),
  CONSTRAINT `fk_follows_followed` FOREIGN KEY (followed_id) REFERENCES `users` (user_id)
) ENGINE=InnoDB;

CREATE TABLE `wants_to_watch` (
  user_id BIGINT UNSIGNED NOT NULL,
  movie_id BIGINT UNSIGNED NOT NULL,
  add_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, movie_id),
  CONSTRAINT `fk_wants_to_watch_user` FOREIGN KEY (user_id) REFERENCES `users` (user_id),
  CONSTRAINT `fk_wants_to_watch_target` FOREIGN KEY (movie_id) REFERENCES `movie` (movie_id)
) ENGINE=InnoDB;

CREATE TABLE `review_like` (
  user_id BIGINT UNSIGNED NOT NULL,
  review_id BIGINT UNSIGNED NOT NULL,
  like_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, review_id),
  CONSTRAINT `fk_review_like_user` FOREIGN KEY (user_id) REFERENCES `users` (user_id),
  CONSTRAINT `fk_review_like_target` FOREIGN KEY (review_id) REFERENCES `review` (review_id)
) ENGINE=InnoDB;

CREATE TABLE `watches` (
  user_id BIGINT UNSIGNED NOT NULL,
  movie_id BIGINT UNSIGNED NOT NULL,
  watch_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, movie_id),
  CONSTRAINT `fk_watches_user` FOREIGN KEY (user_id) REFERENCES `users` (user_id),
  CONSTRAINT `fk_watches_target` FOREIGN KEY (movie_id) REFERENCES `movie` (movie_id)
) ENGINE=InnoDB;

CREATE TABLE `cinema` (
  cinema_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cinema_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(32) NULL,
  district VARCHAR(100) NOT NULL,
  street VARCHAR(255) NOT NULL,
  building VARCHAR(255) NULL,
  PRIMARY KEY (cinema_id)
) ENGINE=InnoDB;

CREATE TABLE `hall` (
  cinema_id BIGINT UNSIGNED NOT NULL,
  hall_id BIGINT UNSIGNED NOT NULL,
  hall_name VARCHAR(100) NOT NULL,
  capacity INT UNSIGNED NOT NULL,
  PRIMARY KEY (cinema_id, hall_id),
  CONSTRAINT `fk_hall_cinema` FOREIGN KEY (cinema_id) REFERENCES `cinema` (cinema_id),
  CONSTRAINT `chk_hall_capacity` CHECK (capacity > 0)
) ENGINE=InnoDB;

CREATE TABLE `seat` (
  cinema_id BIGINT UNSIGNED NOT NULL,
  hall_id BIGINT UNSIGNED NOT NULL,
  seat_id BIGINT UNSIGNED NOT NULL,
  seat_number VARCHAR(20) NOT NULL,
  seat_type VARCHAR(50) NOT NULL,
  PRIMARY KEY (cinema_id, hall_id, seat_id),
  CONSTRAINT `fk_seat_hall` FOREIGN KEY (cinema_id, hall_id) REFERENCES `hall` (cinema_id, hall_id)
) ENGINE=InnoDB;

CREATE TABLE `screening` (
  screening_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  movie_id BIGINT UNSIGNED NOT NULL,
  cinema_id BIGINT UNSIGNED NOT NULL,
  hall_id BIGINT UNSIGNED NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  PRIMARY KEY (screening_id),
  UNIQUE KEY uq_screening_hall (screening_id, cinema_id, hall_id),
  CONSTRAINT `fk_screening_movie` FOREIGN KEY (movie_id) REFERENCES `movie` (movie_id),
  CONSTRAINT `fk_screening_hall` FOREIGN KEY (cinema_id, hall_id) REFERENCES `hall` (cinema_id, hall_id),
  CONSTRAINT `chk_screening_times` CHECK (end_time > start_time)
) ENGINE=InnoDB;

CREATE TABLE `screening_seat` (
  screening_id BIGINT UNSIGNED NOT NULL,
  screening_seat_id BIGINT UNSIGNED NOT NULL,
  cinema_id BIGINT UNSIGNED NOT NULL,
  hall_id BIGINT UNSIGNED NOT NULL,
  seat_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  PRIMARY KEY (screening_id, screening_seat_id),
  UNIQUE KEY uq_screening_physical_seat (screening_id, cinema_id, hall_id, seat_id),
  CONSTRAINT `fk_ss_screening_hall` FOREIGN KEY (screening_id, cinema_id, hall_id) REFERENCES `screening` (screening_id, cinema_id, hall_id),
  CONSTRAINT `fk_ss_physical_seat` FOREIGN KEY (cinema_id, hall_id, seat_id) REFERENCES `seat` (cinema_id, hall_id, seat_id),
  CONSTRAINT `chk_ss_status` CHECK (status IN ('available', 'reserved', 'booked', 'unavailable'))
) ENGINE=InnoDB;

CREATE TABLE `ticket` (
  ticket_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  screening_id BIGINT UNSIGNED NOT NULL,
  screening_seat_id BIGINT UNSIGNED NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  booking_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ticket_id),
  UNIQUE KEY uq_ticket_screening_seat (screening_id, screening_seat_id),
  CONSTRAINT `fk_ticket_user` FOREIGN KEY (user_id) REFERENCES `users` (user_id),
  CONSTRAINT `fk_ticket_screening_seat` FOREIGN KEY (screening_id, screening_seat_id) REFERENCES `screening_seat` (screening_id, screening_seat_id),
  CONSTRAINT `chk_ticket_price` CHECK (price >= 0)
) ENGINE=InnoDB;

CREATE TABLE `discount` (
  discount_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  discount_type VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (discount_id),
  CONSTRAINT `chk_discount_price` CHECK (price >= 0)
) ENGINE=InnoDB;

CREATE TABLE `ticket_discount` (
  ticket_id BIGINT UNSIGNED NOT NULL,
  discount_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (ticket_id, discount_id),
  CONSTRAINT `fk_td_ticket` FOREIGN KEY (ticket_id) REFERENCES `ticket` (ticket_id),
  CONSTRAINT `fk_td_discount` FOREIGN KEY (discount_id) REFERENCES `discount` (discount_id)
) ENGINE=InnoDB;

SHOW TABLES;
