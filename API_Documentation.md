# API Documentation

## Base URL
```
http://localhost:5000
```

## Authentication Endpoints

### 1. User Signup
**POST** `/api/users/signup`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password123",
  "mobileNumber": "+1234567890",
  "country": "United States",
  "dateOfBirth": "1990-01-01"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "mobile_number": "+1234567890",
      "country": "United States",
      "date_of_birth": "1990-01-01",
      "is_verified": false,
      "created_at": "2025-01-20T10:30:00.000Z"
    },
    "emailSent": true
  }
}
```

### 2. User Login
**POST** `/api/users/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "mobile_number": "+1234567890",
      "country": "United States",
      "date_of_birth": "1990-01-01",
      "is_verified": true,
      "created_at": "2025-01-20T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (Not Verified):**
```json
{
  "success": false,
  "message": "Please verify your email address before logging in",
  "requiresVerification": true
}
```

### 3. Get User Profile (Protected)
**GET** `/api/users/profile`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "mobile_number": "+1234567890",
      "country": "United States",
      "date_of_birth": "1990-01-01",
      "created_at": "2025-01-20T10:30:00.000Z"
    }
  }
}
```

## Email Verification Endpoints

### 4. Verify Email
**GET** `/api/users/verify-email/:token`

**Example:**
```
GET /api/users/verify-email/abc123def456ghi789
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully! Welcome to our platform.",
  "data": {
    "user": {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "mobile_number": "+1234567890",
      "country": "United States",
      "date_of_birth": "1990-01-01",
      "is_verified": true,
      "created_at": "2025-01-20T10:30:00.000Z"
    }
  }
}
```

### 5. Resend Verification Email
**POST** `/api/users/resend-verification`

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification email sent successfully"
}
```

## Countries Endpoints

### 6. Get All Countries
**GET** `/api/users/countries`

**Response:**
```json
{
  "success": true,
  "message": "Countries fetched successfully",
  "data": [
    {
      "name": "United States",
      "code": "US",
      "iso3": "USA",
      "phone_code": "+1",
      "flag": "🇺🇸"
    },
    {
      "name": "United Kingdom",
      "code": "GB",
      "iso3": "GBR",
      "phone_code": "+44",
      "flag": "🇬🇧"
    }
  ]
}
```

### 7. Get Countries with Phone Codes
**GET** `/api/users/countries/phone-codes`

**Response:**
```json
{
  "success": true,
  "message": "Countries with phone codes fetched successfully",
  "data": [
    {
      "name": "Afghanistan",
      "code": "AF",
      "iso3": "AFG",
      "phone_code": "+93",
      "flag": "🇦🇫"
    },
    {
      "name": "Albania",
      "code": "AL",
      "iso3": "ALB",
      "phone_code": "+355",
      "flag": "🇦🇱"
    }
  ]
}
```

### 8. Get Country by Code
**GET** `/api/users/countries/:code`

**Example:**
```
GET /api/users/countries/US
```

**Response:**
```json
{
  "success": true,
  "message": "Country fetched successfully",
  "data": {
    "name": "United States",
    "code": "US",
    "iso3": "USA",
    "phone_code": "+1",
    "flag": "🇺🇸"
  }
}
```

## Health Check Endpoints

### 9. Server Health Check
**GET** `/`

**Response:**
```json
{
  "message": "Backend server is running!",
  "timestamp": "2025-01-20T10:30:00.000Z",
  "status": "healthy"
}
```

### 10. Database Health Check
**GET** `/health/db`

**Response:**
```json
{
  "success": true,
  "message": "Database connection is healthy",
  "data": {
    "server_time": "2025-01-20T10:30:00.000Z",
    "db_version": "PostgreSQL 15.4 on x86_64-pc-linux-gnu",
    "connection_status": "connected"
  }
}
```

## Error Responses

### Validation Error
```json
{
  "success": false,
  "message": "All fields are required"
}
```

### Authentication Error
```json
{
  "success": false,
  "message": "Access token required"
}
```

### Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Authentication Flow

1. **Signup** → User receives verification email
2. **Click verification link** → Email gets verified
3. **Login** → Get JWT token
4. **Use token** → Access protected routes

## Notes

- All timestamps are in ISO 8601 format
- JWT tokens expire in 24 hours
- Verification tokens expire in 24 hours
- Email verification is required before login
- All protected routes require `Authorization: Bearer <token>` header