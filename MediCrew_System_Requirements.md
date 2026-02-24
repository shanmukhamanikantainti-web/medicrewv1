# SYSTEM REQUIREMENTS DOCUMENT (SRD)

## MediCrew -- Intelligent Healthcare in Real Time

------------------------------------------------------------------------

# 1. System Overview

MediCrew is an AI-powered healthcare web application designed to connect
patients and doctors in real time through intelligent monitoring,
AI-assisted diagnosis, IoT device integration, and secure administrative
governance.

The system supports secure Email + OTP authentication, role-based access
control (RBAC), AI health analysis, device monitoring, and structured
admin access.

------------------------------------------------------------------------

# 2. System Architecture

## 2.1 Technology Stack

  Layer            Technology
  ---------------- ------------------------------------------
  Frontend         Vite + React
  Backend          JavaScript (API / Business Logic Layer)
  Database         Supabase (PostgreSQL)
  Authentication   Supabase Email + OTP
  AI Integration   External AI API
  Hosting          Cloud Deployment (Vercel/Firebase/Other)

------------------------------------------------------------------------

# 3. User Roles

-   Patient
-   Doctor
-   Admin
-   SuperAdmin

All permissions must be validated server-side.

------------------------------------------------------------------------

# 4. Functional Requirements

## 4.1 Authentication

-   Email-based OTP login
-   Role selection (Patient / Doctor)
-   SuperAdmin seeding based on predefined email
-   Secure session management
-   OTP expiration (5 minutes)

------------------------------------------------------------------------

## 4.2 Patient Features

-   AI health assistant (image + symptom description)
-   View AI-generated results
-   Connect IoT device using Device ID
-   View health metrics (Heart Rate, SpO2, Temperature, BP)
-   Book appointments

------------------------------------------------------------------------

## 4.3 Doctor Features

-   Secure OTP login
-   Upload verification credentials
-   Monitor assigned patients
-   Receive alerts for abnormal vitals
-   Manage appointments

------------------------------------------------------------------------

## 4.4 Admin Features

Route: `/admin`

-   User management
-   Doctor approval/rejection
-   Device management (Activate / Deactivate / Reassign / Reset)
-   Temporary admin assignment
-   Audit logs
-   Secure Ctrl + Q access gate

Access Code: DTI2026MEDICREW4240\
Validated server-side and restricted to specific email.

------------------------------------------------------------------------

## 4.5 AI Health Assistant

-   Accept medical image + description
-   Process through AI API
-   Return:
    -   Possible condition
    -   Recommended first aid
    -   Urgency level
-   Graceful error handling if AI fails

------------------------------------------------------------------------

## 4.6 IoT Device Integration

Each device stores:

-   Device ID
-   Linked Patient ID
-   Status (Active / Inactive)
-   Last Sync Timestamp

Real-time simulation via polling (3--5 sec high priority, 10--15 sec
medium priority).

------------------------------------------------------------------------

# 5. Non-Functional Requirements

## 5.1 Security

-   Backend-only role validation
-   OTP expiration enforcement
-   Secure Supabase session handling
-   No frontend permission trust
-   Audit logging for admin actions

## 5.2 Performance

-   Optimized API calls
-   Efficient polling intervals
-   Fast dashboard rendering

## 5.3 Reliability

-   AI failure fallback
-   Session recovery
-   Automatic temporary admin expiry

## 5.4 Scalability

-   Modular RBAC system
-   Expandable permission model
-   Future mobile compatibility

------------------------------------------------------------------------

# 6. UI/UX Theme Requirements

The MediCrew system must follow a clean, modern, premium healthcare
theme inspired by the provided design screenshot.

## 6.1 Design Characteristics

-   Large bold typography for hero sections
-   Minimalistic layout
-   Soft light background
-   Clean whitespace
-   Rounded buttons
-   Smooth shadows
-   Professional medical blue as primary color
-   Subtle gray subtext
-   Modern sans-serif typography

## 6.2 Landing Page Theme

Hero Section:

-   Large headline: "MediCrew --- Intelligent Healthcare in Real Time"
-   Subtext: "AI-powered health monitoring and connected medical
    response."
-   Primary Button: "Get Started as Patient" (Blue, rounded, soft
    shadow)
-   Secondary Button: "Join as Doctor" (Outlined style)

Header:

-   Logo (heart/medical icon)
-   Clean top navigation
-   Rounded Login button

Overall Feel:

-   Apple Health + Modern SaaS aesthetic
-   Clean, corporate, hospital-safe
-   Professional and premium

------------------------------------------------------------------------

# 7. Future Enhancements

-   Push notifications (Firebase FCM)
-   Multi-factor authentication
-   Advanced analytics dashboard
-   Emergency alert escalation system
-   Mobile application support

------------------------------------------------------------------------

# 8. Conclusion

MediCrew is designed as a secure, scalable, AI-integrated healthcare
platform built using modern web technologies. The system prioritizes
security, usability, governance, and intelligent health monitoring while
maintaining a premium, professional design aesthetic.
