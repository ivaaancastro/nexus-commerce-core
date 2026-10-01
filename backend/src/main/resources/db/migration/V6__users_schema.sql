-- Tabla de usuarios
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    birth_date DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    height NUMERIC(5,2),
    weight NUMERIC(5,2),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_code VARCHAR(6),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de direcciones
CREATE TABLE addresses (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    street VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country_code VARCHAR(5) NOT NULL,
    default_address BOOLEAN NOT NULL DEFAULT FALSE
);

-- Índice para búsquedas por email
CREATE INDEX idx_users_email ON users(email);

-- Índice para direcciones por usuario
CREATE INDEX idx_addresses_user_id ON addresses(user_id);
