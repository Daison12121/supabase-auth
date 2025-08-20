---
description: Repository Information Overview
alwaysApply: true
---

# Supabase Auth Server Information

## Summary
Node.js server application that provides authentication and user management services using Supabase as a backend. The server includes a Tilda integration for user data display and a referral system with multi-level rewards.

## Structure
- `/` - Root directory with main server files
- `/.zencoder` - Configuration directory for Zencoder
- `/tilda-display-user-data.js` - Script for displaying user data on Tilda websites
- `/referral-routes.js` - API routes for the referral system
- `/tilda-referral-system.js` - Client-side script for the referral system

## Language & Runtime
**Language**: JavaScript (Node.js)
**Version**: ES Modules syntax
**Build System**: None (interpreted)
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- express - Web server framework
- node-fetch - HTTP client for making requests to Supabase
- dotenv - Environment variable management
- cors - Cross-Origin Resource Sharing middleware
- body-parser - Request body parsing middleware

## Server Configuration
**Main File**: index.js
**Port**: Configurable via PORT environment variable (default: 8080)
**API Endpoints**:
- GET / - Health check endpoint
- POST /get-user - Retrieve user data by email
- POST /referral/register-with-referral - Register user with referral code
- POST /referral/referral-info - Get referral program information
- POST /referral/process-referral-payment - Process referral payments

## Database
**Type**: Supabase (PostgreSQL)
**Tables**:
- users - User information with referral data
- referral_transactions - Referral payment transactions

## Features
**User Management**:
- User lookup by email
- User data display on Tilda websites

**Referral System**:
- 3-level referral structure (30%, 10%, 5%)
- Referral code generation and tracking
- Referral payment processing
- Referral statistics and reporting

## Client Integration
**Tilda Integration**:
- User data display script for Tilda websites
- Referral system widget for Tilda websites
- Form interceptors for capturing user emails

## Environment Variables
**Required**:
- SUPABASE_URL - Supabase project URL
- SUPABASE_KEY - Supabase API key
- PORT - Server port (optional, default: 8080)

## Deployment
The server is designed to be deployed on Railway or similar platforms that support Node.js applications.