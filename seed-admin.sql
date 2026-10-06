INSERT INTO users (username, password_hash)
VALUES (
    'feria_admin',
    '$2a$12$w6s1suw4mGMKWy4PC2tRJe.fcU1Qkx9dk99H99LKpsi7wynl5mQCO'
)
ON CONFLICT (username) DO NOTHING;
