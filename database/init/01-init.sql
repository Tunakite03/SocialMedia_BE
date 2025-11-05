#!/bin/bash
set -e

# This script will be executed when the PostgreSQL container starts for the first time

echo "🚀 Initializing Otakomi Database..."

# Create additional databases if needed
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create test database
    CREATE DATABASE onway_test;
    
    -- Create additional schemas if needed
    CREATE SCHEMA IF NOT EXISTS analytics;
    
    -- Grant permissions
    GRANT ALL PRIVILEGES ON DATABASE onway_test TO postgres;
    GRANT ALL PRIVILEGES ON SCHEMA analytics TO postgres;
    
    -- Create extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    
    \echo 'Database initialization completed successfully!'
EOSQL

echo "✅ Database setup completed!"