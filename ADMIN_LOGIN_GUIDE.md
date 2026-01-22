# Admin Login Guide

## ✅ Admin User Created Successfully!

Your admin account has been created:
- **Email**: `matthewkiata@gmail.com`
- **Password**: `12121212`
- **Admin Status**: ✅ Yes

## Access the Login Page

### Option 1: Direct File Access
Open the login page directly in your browser:
```
file:///Users/matthew/Documents/WeChat Viral/admin/login.html
```

### Option 2: Through Backend Server (Recommended)
1. Make sure your backend server is running:
   ```bash
   cd backend
   npm run dev
   ```

2. Open in browser:
   ```
   http://localhost:3000/admin/login.html
   ```

3. Login with:
   - Email: `matthewkiata@gmail.com`
   - Password: `12121212`

## Features

### Login Page (`admin/login.html`)
- Clean, modern UI
- Email/password authentication
- Automatic token storage
- Error handling

### Admin Dashboard (`admin/dashboard.html`)
- View statistics (users, scans, follows, invites)
- View recent events
- Auto-redirects to login if not authenticated
- Logout functionality

## API Endpoints

### Email/Password Login
- **POST** `/api/auth/login-email`
- **Body**: 
  ```json
  {
    "email": "matthewkiata@gmail.com",
    "password": "12121212"
  }
  ```
- **Response**: 
  ```json
  {
    "data": {
      "token": "JWT_TOKEN",
      "user": { ... }
    }
  }
  ```

### Using the Token
All admin API endpoints require the token in the Authorization header:
```
Authorization: Bearer <token>
```

## Notes

- The token is stored in `localStorage` as `admin_token`
- Token expires in 30 days
- The dashboard automatically checks authentication on load
- If token is invalid, you'll be redirected to login

## Troubleshooting

### "Cannot GET /admin/login.html"
- Make sure backend server is running
- Check that `admin/` folder exists in project root
- Verify static file serving is configured in `backend/src/index.ts`

### "Invalid email or password"
- Verify the user was created successfully
- Check that database migration was run (email and password_hash columns exist)
- Try running the create script again

### "401 Unauthorized" on dashboard
- Token may have expired
- Clear localStorage and login again
- Check that token is being sent in Authorization header
