# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app/backend

# Copy package.json and package-lock.json first to leverage Docker cache
COPY backend/package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema and generate client
COPY backend/prisma ./prisma
RUN npx prisma generate

# Copy the rest of the backend code
COPY backend/ ./

# Expose the API port
EXPOSE 4000

# Define the command to run the app
CMD ["npm", "run", "start:prod"]
