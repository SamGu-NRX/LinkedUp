#!/bin/bash

# Pull latest changes from Git
git pull

# Install dependencies using pnpm
pnpm install

# Start the development server (Optional)
pnpm run dev
