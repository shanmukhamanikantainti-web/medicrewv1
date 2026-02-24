# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

## Project Title: MediCrew -- Intelligent Healthcare Management System

------------------------------------------------------------------------

# 1. Introduction

## 1.1 Purpose

This document defines the software requirements for MediCrew, an
AI-powered healthcare management platform designed to connect patients,
doctors, and administrators through a secure, scalable web system.

The system integrates: - Email-based OTP authentication\
- Role-Based Access Control (RBAC)\
- AI-powered health analysis\
- IoT health monitoring device integration\
- Admin governance controls

------------------------------------------------------------------------

## 1.2 Scope

MediCrew is a web-based healthcare platform that enables: - Patients to
receive AI-assisted health analysis - Doctors to monitor and manage
patients - Admins to govern system operations - Secure OTP-based login
and role-based access - IoT health data visualization - Controlled admin
entry via secure access gate

------------------------------------------------------------------------

# 2. Overall Description

## 2.1 Product Perspective

MediCrew is a full-stack web application built using:

### Frontend

-   Vite + React
-   Modern component-based UI
-   React state management
-   React Query for polling-based updates

### Backend

-   JavaScript (Node-based logic / API layer)
-   Role validation
-   AI request handling
-   Device management logic
-   Admin access validation

### Database & Authentication

-   Supabase
    -   PostgreSQL database
    -   Email + OTP authentication
    -   User storage
    -   Role management
    -   Session handling

------------------------------------------------------------------------

# 3. System Architecture

Frontend (Vite + React)\
↓\
Backend (JavaScript API Layer)\
↓\
Supabase (Database + Authentication)

Optional: External AI API for AI health assistant

------------------------------------------------------------------------

# 4. User Roles

The system supports the following roles: - Patient\
- Doctor\
- Admin\
- SuperAdmin

All permissions are validated server-side.

------------------------------------------------------------------------

# 5. Functional Requirements

## 5.1 Authentication System

### Email + OTP Login (Supabase)

-   User selects role (Patient or Doctor)
-   User enters email
-   Supabase sends OTP
-   OTP verified securely
-   Session created
-   Backend assigns role if new user

### SuperAdmin Seeding

If email equals shanmukhamanikanta.inti@gmail.com: - role = SuperAdmin

------------------------------------------------------------------------

## 5.2 Role-Based Access Control (RBAC)

-   All role checks validated in backend
-   No frontend-only permission trust
-   Protected route access restriction

------------------------------------------------------------------------

## 5.3 Doctor Registration & Verification

-   Doctor selects "Join as Doctor"
-   Role preserved during OTP flow
-   Upload verification documents
-   Admin approves/rejects
-   Login allowed even if pending

------------------------------------------------------------------------

## 5.4 AI Health Assistant

Patient can: - Upload medical image - Enter symptom description - Submit
for AI analysis

System returns: - Possible condition - Recommended first aid - Urgency
level

------------------------------------------------------------------------

## 5.5 IoT Device Management

Each device stores: - Device ID - Linked Patient ID - Status (Active /
Inactive) - Last Sync Timestamp

Admin capabilities: - View all devices - Activate / Deactivate device -
Reassign device - Reset device binding

------------------------------------------------------------------------

## 5.6 Admin Dashboard

Route: /admin

Sections: - Users - Doctors - Devices - Appointments - Admin
Management - Audit Logs

------------------------------------------------------------------------

## 5.7 Admin Access Gate

Access methods: 1. Role-based (Admin/SuperAdmin) 2. Ctrl + Q → Access
Code Modal

Access Code: DTI2026MEDICREW4240

Validation conditions: - Email must equal
shanmukhamanikanta.inti@gmail.com - Code must match - Server-side
validation only

Session-level access only. No permanent role mutation.

------------------------------------------------------------------------

## 5.8 Temporary Admin Access

-   SuperAdmin grants temporary Admin role
-   Expiration timestamp enforced
-   Auto-revert to previous role after expiry

------------------------------------------------------------------------

## 5.9 Polling-Based Updates

-   High-priority: 3--5 seconds
-   Medium-priority: 10--15 seconds
-   Pause when tab inactive

------------------------------------------------------------------------

# 6. Non-Functional Requirements

## Security

-   OTP expiration enforced
-   Backend role validation
-   No frontend permission trust
-   Secure Supabase session handling
-   Audit logging for admin actions

## Performance

-   Optimized API calls
-   Efficient polling intervals
-   Smooth dashboard rendering

## Reliability

-   Graceful AI failure handling
-   OTP retry support
-   Automatic admin expiry handling

## Usability

-   Clean, responsive UI
-   Minimal admin exposure
-   Clear error messaging

------------------------------------------------------------------------

# 7. Technology Stack Summary

  Layer            Technology
  ---------------- -----------------------
  Frontend         Vite + React
  Backend          JavaScript
  Database         Supabase (PostgreSQL)
  Authentication   Supabase Email + OTP
  AI Integration   External AI API

------------------------------------------------------------------------

# 8. Future Enhancements

-   Push notifications (Firebase FCM)
-   Granular permission matrix
-   Multi-factor authentication
-   Mobile application
-   Advanced analytics dashboard

------------------------------------------------------------------------

# 9. Conclusion

MediCrew is a secure, scalable healthcare management system built
with: - Vite + React frontend - JavaScript backend - Supabase database &
OTP authentication

Designed to be secure, expandable, and production-ready.
