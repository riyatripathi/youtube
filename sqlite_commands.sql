PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "products" (
    product_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT,
    product_link TEXT,
    affiliate_link TEXT,
    product_description TEXT,
    youtube_link TEXT DEFAULT NULL
);

CREATE TABLE admin_users ( id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL );

INSERT INTO admin_users VALUES(1,'admin','$2a$12$LDbEt9J6m3unUZtIpW7WleMxpbnVXgKuNm9wD.7S4l8UyPsv5ZC7e');
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('admin_users',1);
COMMIT;