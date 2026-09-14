-- Runs once, when the Postgres volume is first created. The expense API's database comes
-- from POSTGRES_DB; each extra service gets its own database here.
CREATE DATABASE activity;
