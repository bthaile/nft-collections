#!/bin/bash

# Navigate to web directory
cd web

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the project
echo "Building project..."
npm run build

# Output success message
echo "Build completed successfully!" 