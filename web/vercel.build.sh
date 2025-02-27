#!/bin/bash

# Navigate to web directory
cd web

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Build the project
echo "Building project..."
pnpm run build

# Output success message
echo "Build completed successfully!" 