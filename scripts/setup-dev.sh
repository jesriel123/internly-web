#!/bin/bash
# Development Environment Setup Script

set -e

echo "🚀 Setting up Internly Web development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from .env.development..."
    cp .env.development .env.local
    echo "⚠️  Please update .env.local with your actual Supabase credentials"
else
    echo "✅ .env.local already exists"
fi

# Check if TypeScript is configured
if [ -f tsconfig.json ]; then
    echo "✅ TypeScript configuration found"
else
    echo "⚠️  TypeScript configuration not found"
fi

# Create necessary directories
mkdir -p src/types
mkdir -p supabase/migrations
mkdir -p public/assets

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your Supabase credentials"
echo "2. Run 'npm start' to start the development server"
echo "3. Visit http://localhost:3000"
echo ""
