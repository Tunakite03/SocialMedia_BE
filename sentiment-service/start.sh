#!/bin/bash

# OnWay Sentiment Service Startup Script

echo "🚀 Starting OnWay Sentiment Analysis Service..."

# Check if Python 3.8+ is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "📈 Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Copy environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️ Creating environment file..."
    cp .env.example .env
    echo "✅ Please configure .env file with your settings"
fi

# Start the service
echo "🎯 Starting sentiment analysis service..."
echo "🌐 Service will be available at http://localhost:8000"
echo "📚 API documentation at http://localhost:8000/docs"

uvicorn main:app --host 0.0.0.0 --port 8000 --reload