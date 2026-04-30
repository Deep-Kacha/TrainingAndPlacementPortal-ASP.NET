# 🎓 Training & Placement Portal — RK University

A full-featured, role-based campus placement management portal built for **RK University** using **ASP.NET MVC** and **Entity Framework**. This system digitizes the entire campus recruitment lifecycle — from student registration and eligibility screening to drive scheduling and placement tracking.

---

## 📌 Table of Contents

- [About the Project](#about-the-project)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [User Roles](#user-roles)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Database Setup](#database-setup)
- [Configuration](#configuration)
- [Screenshots](#screenshots)
- [Contributing](#contributing)
- [License](#license)

---

## 📖 About the Project

The RK University Training & Placement Cell handles campus recruitments for hundreds of students every academic year. This portal was built to replace manual, paper-based processes with a centralized digital system aligned with the university's official placement policies.

It ensures transparency, efficiency, and a smooth experience for all stakeholders — students and placement officers (TPOs). Companies do not have a login — they interact with the portal as **guests**, only submitting a placement drive interest form through a public-facing panel.

---

## ✅ Features

### 🧑‍🎓 Student
- Register and maintain a placement profile
- Auto-eligibility check based on CGPA, backlogs, and attendance
- Browse and apply to eligible placement drives
- Track application status and offer letters

### 🏢 Company / Recruiter (Guest Panel — No Login Required)
- Companies are **not registered users** of the portal and have no login credentials
- A company representative visits the public **Guest Panel** to submit a placement drive interest/request form
- They can only fill and submit the form — they cannot view student data, drive details, or any other portal content
- Once submitted, the TPO/Admin reviews the request and manages everything internally

### 🛡️ Admin / TPO
- Manage all students, companies, and drives centrally
- Configure eligibility criteria per drive
- Schedule placement drives, pre-placement talks, and interview rounds
- Broadcast notices and announcements to students
- Generate placement reports (CTC, offer counts, company-wise data)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | ASP.NET MVC 5 |
| Language | C# |
| ORM | Entity Framework |
| View Engine | Razor (`.cshtml`) |
| Frontend | HTML5, CSS3, JavaScript |
| Database | Microsoft SQL Server |
| IDE | Visual Studio |

> **Language breakdown:** HTML 58% · C# 32% · JavaScript 8% · CSS 2%

---

## 👤 User Roles

| Role | Access Level |
|---|---|
| **Admin / TPO** | Full access — students, companies, drives, eligibility rules, reports, notices |
| **Student** | Profile management, drive browsing, applications, status tracking |
| **Company (Guest)** | Public form submission only — no login, no portal access |

---

## 📁 Project Structure

```
TrainingAndPlacementPortal-ASP.NET/
│
├── .vs/                                  # Visual Studio solution settings
│
├── TrainingAndPlacementPortal/           # Main ASP.NET MVC project
│   ├── Controllers/                      # Request handling & business routing
│   │   ├── AdminController.cs
│   │   ├── StudentController.cs
│   │   └── CompanyController.cs
│   │
│   ├── Models/                           # Entity Framework models & DbContext
│   │   ├── Student.cs
│   │   ├── Company.cs
│   │   ├── Drive.cs
│   │   ├── Application.cs
│   │   └── PlacementPortalContext.cs
│   │
│   ├── Views/                            # Razor view templates (.cshtml)
│   │   ├── Admin/
│   │   ├── Student/
│   │   ├── Company/
│   │   └── Shared/
│   │
│   ├── App_Data/                         # Database scripts & seed data
│   ├── Content/                          # CSS & static assets
│   ├── Scripts/                          # JavaScript files
│   ├── App_Start/                        # Route & bundle config
│   └── Web.config                        # App configuration & connection string
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- [Visual Studio 2019 or later](https://visualstudio.microsoft.com/) (with ASP.NET workload)
- [.NET Framework 4.x](https://dotnet.microsoft.com/en-us/download/dotnet-framework)
- [Microsoft SQL Server](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) (Express or higher)
- [SQL Server Management Studio (SSMS)](https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms) *(optional but recommended)*

---

### Installation

1. **Clone the repository:**

```bash
git clone https://github.com/Deep-Kacha/TrainingAndPlacementPortal-ASP.NET.git
cd TrainingAndPlacementPortal-ASP.NET
```

2. **Open the solution in Visual Studio:**

```
File → Open → Project/Solution → TrainingAndPlacementPortal.sln
```

3. **Restore NuGet packages:**

Visual Studio should restore packages automatically. If not:
```
Tools → NuGet Package Manager → Manage NuGet Packages for Solution → Restore
```

---

### Database Setup

1. Open **SQL Server Management Studio** and create a new database:

```sql
CREATE DATABASE TrainingAndPlacementPortalDB;
```

2. Update the connection string in `Web.config`:

```xml
<connectionStrings>
  <add name="PlacementPortalContext"
       connectionString="Data Source=YOUR_SERVER_NAME;
                         Initial Catalog=TrainingAndPlacementPortalDB;
                         Integrated Security=True"
       providerName="System.Data.SqlClient" />
</connectionStrings>
```

3. Run **Entity Framework Migrations** (via Package Manager Console):

```powershell
Update-Database
```

This will scaffold all tables automatically from the defined models.

---

## ⚙️ Configuration

| Setting | Location | Description |
|---|---|---|
| Database connection | `Web.config` → `<connectionStrings>` | SQL Server connection details |
| App settings | `Web.config` → `<appSettings>` | Environment-specific config |
| Routes | `App_Start/RouteConfig.cs` | URL routing rules |
| Bundles | `App_Start/BundleConfig.cs` | CSS/JS bundling & minification |

---

## 🔐 Default Credentials *(Development Only)*

> ⚠️ Change all default credentials before deploying to production.

| Role | Username | Password |
|---|---|---|
| Admin / TPO | `admin@rku.ac.in` | `Admin@123` |
| Student | *(self-registered)* | — |
| Company | *(no login — guest form only)* | — |

---

## 🤝 Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "Add: brief description"`
4. Push to your branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please make sure your code follows existing conventions and passes all builds before submitting.

---

## 📄 License

This project is intended for academic and university use. Please refer to the repository owner for licensing details.

---

## 👨‍💻 Author

**Deep Kacha**
Forked from [rushisorathiya89/TrainingAndPlacementPortal-ASP.NET](https://github.com/rushisorathiya89/TrainingAndPlacementPortal-ASP.NET)

Built for the **RK University Training & Placement Cell** — following the university's official placement rules & regulations.

---

*⭐ If you found this project helpful, consider giving it a star on GitHub!*
