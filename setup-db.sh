#!/bin/bash

# Otakomi Database Setup Script

echo "🐳 Setting up Otakomi Database with Docker..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker is running"

# Create .env file for database if it doesn't exist
if [ ! -f ".env.db" ]; then
    echo "⚙️ Creating database environment file..."
    cat > .env.db << EOF
# Database Configuration
POSTGRES_DB=onway_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password123

# pgAdmin Configuration
PGADMIN_DEFAULT_EMAIL=admin@otakomi.com
PGADMIN_DEFAULT_PASSWORD=admin123
EOF
    echo "✅ Database environment file created (.env.db)"
fi

# Start database services
echo "🚀 Starting database services..."
docker-compose -f docker-compose.dev.yml --env-file .env.db up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
until docker exec onway_postgres_dev pg_isready -U postgres; do
    echo "Database is starting up..."
    sleep 2
done

echo "✅ Database is ready!"

# Show connection information
echo ""
echo "🎉 Database setup completed successfully!"
echo ""
echo "📋 Connection Information:"
echo "   Database Host: localhost"
echo "   Database Port: 5432"
echo "   Database Name: onway_db"
echo "   Username: postgres"
echo "   Password: password123"
echo ""
echo "🔗 Database URL for your .env file:"
echo "   DATABASE_URL=\"postgresql://postgres:password123@localhost:5432/onway_db\""
echo ""
echo "🖥️  pgAdmin Web Interface:"
echo "   URL: http://localhost:8080"
echo "   Email: admin@otakomi.com"
echo "   Password: admin123"
echo ""
echo "📊 Redis Cache (optional):"
echo "   Host: localhost"
echo "   Port: 6379"
echo ""
echo "🛠️  Useful commands:"
echo "   Stop services: docker-compose -f docker-compose.dev.yml down"
echo "   View logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "   Reset database: docker-compose -f docker-compose.dev.yml down -v"
echo ""
echo "Next steps:"
echo "1. Update your .env file with the DATABASE_URL above"
echo "2. Run: npm run db:migrate"
echo "3. Run: npm run db:seed"