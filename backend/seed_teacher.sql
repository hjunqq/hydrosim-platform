-- Manual seed for default teacher account
-- Run this in your PostgreSQL database

-- Create teacher with password 'teacher123'
-- Password hash generated with: python -c "from passlib.hash import bcrypt; print(bcrypt.hash('teacher123'))"

INSERT INTO teachers (username, password_hash, email, is_active, created_at)
VALUES (
    'teacher',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eoLe/1FYZZj.',  -- password: teacher123
    'teacher@example.com',
    true,
    NOW()
)
ON CONFLICT (username) DO NOTHING;

-- Verify
SELECT id, username, email, is_active, created_at FROM teachers;
