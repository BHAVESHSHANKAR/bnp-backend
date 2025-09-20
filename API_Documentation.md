# Admin API Documentation

## Base URL
```
http://localhost:6969
```

## Admin Authentication Endpoints

### 1. Admin Signup
**POST** `/api/admin/signup`

**Request Body:**
```json
{
  "username": "admin123",
  "email": "admin@example.com",
  "password": "securepassword123",
  "fullName": "John Admin",
  "bankName": "First National Bank",
  "role": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin created successfully",
  "data": {
    "admin": {
      "id": 1,
      "username": "admin123",
      "email": "admin@example.com",
      "full_name": "John Admin",
      "bank_name": "First National Bank",
      "role": "admin",
      "is_active": true,
      "created_at": "2025-01-20T10:30:00.000Z"
    }
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Username already exists"
}
```

```json
{
  "success": false,
  "message": "Email already exists"
}
```

```json
{
  "success": false,
  "message": "Username, email, password, full name, and bank name are required"
}
```

### 2. Admin Login
**POST** `/api/admin/login`

**Request Body:**
```json
{
  "username": "admin123",
  "password": "securepassword123"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "admin": {
      "id": 1,
      "username": "admin123",
      "email": "admin@example.com",
      "full_name": "John Admin",
      "bank_name": "First National Bank",
      "role": "admin",
      "is_active": true,
      "last_login": "2025-01-20T10:30:00.000Z",
      "created_at": "2025-01-20T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

### 3. Get Admin Profile (Protected)
**GET** `/api/admin/profile`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "admin": {
      "id": 1,
      "username": "admin123",
      "email": "admin@example.com",
      "full_name": "John Admin",
      "bank_name": "First National Bank",
      "role": "admin",
      "is_active": true,
      "last_login": "2025-01-20T10:30:00.000Z",
      "created_at": "2025-01-20T10:00:00.000Z"
    }
  }
}
```

### 4. Update Admin Profile (Protected)
**PUT** `/api/admin/profile`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "fullName": "John Updated Admin",
  "email": "updated.admin@example.com",
  "bankName": "Updated National Bank"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "admin": {
      "id": 1,
      "username": "admin123",
      "email": "updated.admin@example.com",
      "full_name": "John Updated Admin",
      "bank_name": "Updated National Bank",
      "role": "admin",
      "is_active": true,
      "updated_at": "2025-01-20T11:00:00.000Z"
    }
  }
}
```

### 5. Change Password (Protected)
**PUT** `/api/admin/change-password`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "currentPassword": "securepassword123",
  "newPassword": "newsecurepassword456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

## Health Check Endpoints

### 6. Server Health Check
**GET** `/`

**Response:**
```json
{
  "message": "Admin Backend Server is running!",
  "timestamp": "2025-01-20T10:30:00.000Z",
  "status": "healthy",
  "system": "admin-only"
}
```

### 7. Database Health Check
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
  "message": "Full name, email, and bank name are required"
}
```

### Authentication Error
```json
{
  "success": false,
  "message": "Access token required"
}
```

### Authorization Error
```json
{
  "success": false,
  "message": "Invalid token"
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

1. **Admin Signup** → Create admin account
2. **Admin Login** → Get JWT token
3. **Use token** → Access protected admin routes

## Validation Rules

### Username
- Minimum 3 characters
- Must be unique
- Can be used for login along with email

### Email
- Must be valid email format
- Must be unique
- Can be used for login along with username

### Password
- Minimum 6 characters
- Hashed using bcrypt with 12 salt rounds

### Full Name
- Required field
- No specific format restrictions

### Bank Name
- Required field
- Represents the bank the admin is associated with
- No specific format restrictions

## Security Features

- JWT tokens expire in 24 hours
- Passwords are hashed using bcrypt
- Rate limiting: 50 requests per minute per IP
- CORS protection
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- Input validation and sanitization
- Protected routes require valid JWT token

## Database Schema

### Admins Table
```sql
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    bank_name VARCHAR(200) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes
- `idx_admins_username` on username
- `idx_admins_email` on email  
- `idx_admins_role` on role
- `idx_admins_active` on is_active
- `idx_admins_bank_name` on bank_name

## Notes

- All timestamps are in ISO 8601 format
- JWT tokens expire in 24 hours
- All protected routes require `Authorization: Bearer <token>` header
- Admin accounts can be deactivated by setting `is_active` to false
- Last login timestamp is updated on successful login
- Role field allows for future role-based access control
## Fi
le Upload Endpoints (Encrypted)

### 6. Upload Customer Files (Protected)
**POST** `/api/files/upload/:customerId`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data
```

**Form Data:**
- `files`: Multiple files (unlimited count, unlimited size)
- `personName`: Full name of the person (required)
- `mobileNumber`: Mobile number of the person (required)

**Example using curl:**
```bash
curl -X POST \
  http://localhost:6969/api/files/upload/CUST123 \
  -H 'Authorization: Bearer your-jwt-token' \
  -F 'personName=John Doe' \
  -F 'mobileNumber=+1234567890' \
  -F 'files=@document1.pdf' \
  -F 'files=@document2.jpg' \
  -F 'files=@document3.docx' \
  -F 'files=@document4.xlsx' \
  -F 'files=@document5.png'
```

**Success Response:**
```json
{
  "success": true,
  "message": "Processed 5 files",
  "data": {
    "uploaded_files": [
      {
        "filename": "document1.pdf",
        "file_id": 1,
        "cloudinary_id": "customer_files/CUST123/1642678800000_document1.pdf",
        "file_size": 1024000,
        "upload_timestamp": "2025-01-20T10:30:00.000Z"
      }
    ],
    "ml_processing": {
      "success": true,
      "message": "Processed 5 files",
      "data": {
        "results": [
          {
            "File": "document1.pdf",
            "NAME": "John Doe",
            "DOB": "1990-01-15",
            "COUNTRY": "United States",
            "COUNTRY_CODE": "US",
            "CARD_EXPIRY_DATE": "2025-12-31",
            "Risk_Score": 0,
            "Status": "Verified",
            "Card_Validity": "Provided",
            "Processed_At": "2025-01-20T10:30:00.000Z",
            "Text_Length": 1250,
            "Extracted_Text_Preview": "This is a sample document containing personal information..."
          }
        ],
        "errors": [],
        "summary": {
          "total_files": 5,
          "successful_processing": 5,
          "failed_processing": 0,
          "processed_at": "2025-01-20T10:30:00.000Z"
        }
      }
    },
    "errors": [],
    "customer_id": "CUST123",
    "person_details": {
      "name": "John Doe",
      "mobile_number": "+1234567890"
    },
    "uploaded_by": {
      "admin_id": 1,
      "username": "admin123",
      "full_name": "John Admin"
    },
    "summary": {
      "total_files": 5,
      "successful_uploads": 5,
      "failed_uploads": 0,
      "ml_processing_success": true
    }
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Person name and mobile number are required"
}
```

```json
{
  "success": false,
  "message": "Please provide a valid mobile number"
}
```

```json
{
  "success": false,
  "message": "No files provided"
}
```

### 7. Get Customer Files (Protected)
**GET** `/api/files/customer/:customerId`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customer_id": "CUST123",
    "files": [
      {
        "id": 1,
        "customer_id": "CUST123",
        "admin_id": 1,
        "person_name": "John Doe",
        "mobile_number": "+1234567890",
        "original_filename": "document1.pdf",
        "cloudinary_id": "customer_files/CUST123/1642678800000_document1.pdf",
        "secure_url": "https://res.cloudinary.com/...",
        "file_size": 1024000,
        "file_hash": "abc123def456...",
        "iv": "1234567890abcdef",
        "file_type": "application/pdf",
        "upload_timestamp": "2025-01-20T10:30:00.000Z",
        "uploaded_by_username": "admin123",
        "uploaded_by_name": "John Admin"
      }
    ],
    "total_files": 1
  }
}
```

### 8. Download File (Protected)
**GET** `/api/files/download/:fileId`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
- Returns the decrypted file as a download
- Sets appropriate Content-Disposition and Content-Type headers

### 9. Delete File (Protected)
**DELETE** `/api/files/:fileId`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully",
  "data": {
    "file_id": "1",
    "filename": "document1.pdf",
    "cloudinary_deleted": true
  }
}
```

### 10. Get Admin's Uploaded Files (Protected)
**GET** `/api/files/my-uploads`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": 1,
        "customer_id": "CUST123",
        "original_filename": "document1.pdf",
        "file_size": 1024000,
        "upload_timestamp": "2025-01-20T10:30:00.000Z"
      }
    ],
    "total_files": 1,
    "admin": {
      "id": 1,
      "username": "admin123",
      "full_name": "John Admin"
    }
  }
}
```

### 11. Get File Statistics (Protected)
**GET** `/api/files/stats`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "total_files": "25",
      "total_size": "52428800",
      "unique_customers": "10"
    },
    "admin": {
      "id": 1,
      "username": "admin123",
      "full_name": "John Admin"
    }
  }
}
```

## File Upload Security Features

### Encryption
- **Algorithm**: AES-256-CBC
- **Key Management**: Derived from environment secret using scrypt
- **IV**: Random 16-byte initialization vector for each file
- **File Integrity**: SHA-256 hash verification

### Upload Limits
- **Maximum Files**: Unlimited files per upload request
- **File Size**: No size restrictions (unlimited)
- **File Types**: All formats supported
- **Storage**: Encrypted files stored in Cloudinary

### Database Schema

#### Customer Files Table
```sql
CREATE TABLE customer_files (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(100) NOT NULL,
    admin_id INTEGER NOT NULL,
    person_name VARCHAR(200) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    cloudinary_id VARCHAR(500) NOT NULL,
    secure_url TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    iv VARCHAR(32) NOT NULL,
    file_type VARCHAR(100),
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id)
);
```

#### File Indexes
- `idx_customer_files_customer_id` on customer_id
- `idx_customer_files_admin_id` on admin_id
- `idx_customer_files_cloudinary_id` on cloudinary_id
- `idx_customer_files_active` on is_active
- `idx_customer_files_upload_timestamp` on upload_timestamp
- `idx_customer_files_person_name` on person_name
- `idx_customer_files_mobile_number` on mobile_number

## File Upload Process

1. **Admin Authentication** → Verify JWT token
2. **File Validation** → Check file count and size limits
3. **Encryption** → Encrypt each file using AES-256-CBC
4. **Cloud Upload** → Upload encrypted files to Cloudinary
5. **Metadata Storage** → Save file metadata in database
6. **Response** → Return upload results and file information

## Security Notes

- All files are encrypted before uploading to Cloudinary
- File integrity is verified using SHA-256 hashes
- Only authenticated admins can upload, download, and manage files
- Soft delete ensures files can be recovered if needed
- Customer ID is required for file organization
- All file operations are logged with admin information

## ML Document Processing

### Supported File Types
- **PDF**: OCR text extraction using Tesseract
- **DOCX**: Direct text extraction from Word documents
- **TXT**: Plain text file processing
- **ZIP**: Batch processing of multiple documents

### Extracted Information
- **NAME**: Person's name using NLP entity recognition
- **DOB**: Date of birth (dates ≤ 2005)
- **COUNTRY**: Country name recognition
- **COUNTRY_CODE**: ISO country code (e.g., US, UK, IN)
- **CARD_EXPIRY_DATE**: Card expiry dates (dates > 2005)

### Risk Assessment
- **Risk Score**: 0-100 based on missing information
  - 0 points: All information present
  - 25 points: One field missing
  - 50 points: Two fields missing
  - 75 points: Three fields missing
  - 100 points: Four or more fields missing
- **Status**: "Verified" (≤50 points) or "Flagged" (>50 points)
- **Card Validity**: "Provided" or "Not Provided"

### ML Backend Endpoints
- **Health Check**: `GET http://localhost:5001/`
- **Process Files**: `POST http://localhost:5001/process-files`
- **Process Single**: `POST http://localhost:5001/process-single`
- **Extract Text**: `POST http://localhost:5001/extract-text`

## Large File Handling

- **No Size Restrictions**: Files of any size can be uploaded
- **Memory Usage**: Large files are processed in memory during encryption
- **Processing Time**: Larger files may take longer to encrypt and upload
- **Server Resources**: Ensure adequate server memory for large file processing
- **Cloudinary Limits**: Subject to Cloudinary account limits and quotas
- **Network Considerations**: Large uploads may require stable internet connection
- **ML Processing**: Files are sent to Python backend for intelligent extraction