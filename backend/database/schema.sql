CREATE DATABASE IF NOT EXISTS cafe_direct;
USE cafe_direct;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'staff', 'rider', 'admin') NOT NULL DEFAULT 'customer',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  KEY users_role_index (role)
);

CREATE TABLE IF NOT EXISTS menu_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  category VARCHAR(80) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(500) NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY menu_items_name_unique (name),
  KEY menu_items_category_index (category),
  KEY menu_items_available_index (is_available)
);

CREATE TABLE IF NOT EXISTS rider_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  vehicle_type VARCHAR(80) NOT NULL,
  plate_number VARCHAR(40) NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  current_status ENUM('available', 'busy', 'offline') NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY rider_profiles_user_unique (user_id),
  CONSTRAINT rider_profiles_user_fk FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  rider_id BIGINT UNSIGNED NULL,
  delivery_address VARCHAR(500) NOT NULL,
  delivery_latitude DECIMAL(10, 8) NOT NULL,
  delivery_longitude DECIMAL(11, 8) NOT NULL,
  delivery_notes VARCHAR(500) NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM(
    'created',
    'confirmed',
    'preparing',
    'ready_for_delivery',
    'out_for_delivery',
    'delivered',
    'completed',
    'cancelled'
  ) NOT NULL DEFAULT 'created',
  payment_status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY orders_customer_index (customer_id),
  KEY orders_rider_index (rider_id),
  KEY orders_status_index (status),
  CONSTRAINT orders_customer_fk FOREIGN KEY (customer_id) REFERENCES users (id),
  CONSTRAINT orders_rider_fk FOREIGN KEY (rider_id) REFERENCES rider_profiles (id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  item_name_snapshot VARCHAR(160) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  line_total DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY (id),
  KEY order_items_order_index (order_id),
  KEY order_items_menu_item_index (menu_item_id),
  CONSTRAINT order_items_order_fk FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE,
  CONSTRAINT order_items_menu_item_fk FOREIGN KEY (menu_item_id) REFERENCES menu_items (id)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  method ENUM('stripe') NOT NULL,
  status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  amount DECIMAL(10, 2) NOT NULL,
  provider_reference VARCHAR(160) NULL,
  provider_client_secret VARCHAR(255) NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY payments_provider_reference_unique (provider_reference),
  KEY payments_order_index (order_id),
  CONSTRAINT payments_order_fk FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rider_locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rider_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  heading DECIMAL(6, 2) NULL,
  speed DECIMAL(8, 2) NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY rider_locations_order_recorded_index (order_id, recorded_at),
  KEY rider_locations_rider_recorded_index (rider_id, recorded_at),
  CONSTRAINT rider_locations_rider_fk FOREIGN KEY (rider_id) REFERENCES rider_profiles (id)
    ON DELETE CASCADE,
  CONSTRAINT rider_locations_order_fk FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE
);
