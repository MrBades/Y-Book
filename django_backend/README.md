# Yeedem SME Ledger App — Django REST Framework (DRF) Backend

This is the fully functioning, production-ready Django REST Framework (DRF) backend module representing the entire SME Ledger, bookkeeping, and customer credit ledger system.

It defines complete relational database entities matching the frontend, fully fledged REST ViewSets, nested serializations, smart multi-modal parsing endpoints (supporting text, voice, and receipt scanning via the Gemini API), and token-based JWT credentials authentication.

---

## 📁 Directory Structure

```text
django_backend/
├── api/                      # Main API Submodule application
│   ├── models.py             # SQLite / Postgres database schema models
│   ├── serializers.py        # Serializer representations converting models to dynamic JSON
│   ├── views.py              # Controller ViewSets, search, filters & dashboard KPI endpoints
│   ├── urls.py               # Nested routes for customers, invoices, products, restocks...
│   └── utils.py              # Smart-AI multi-modal entry parser (Gemini API & local fallbacks)
├── yeedem_project/           # Master Django project setting context
│   ├── settings.py           # Database context, installed apps, CORS, SimpleJWT, configurations
│   └── urls.py               # Top level routing URL dispatcher
├── manage.py                 # Django command line manager
└── requirements.txt          # Python module dependencies manifest
```

---

## 🚀 Quick Start Guide

Follow these steps to deploy and test the backend on your local server.

### 1. Prerequisites
Ensure you have **Python 3.8+** installed on your operating system.

### 2. Procure the Source Files
Export this project repository as a `.zip` archive or clone it into your local directory using the AI Studio settings controls on the top right.

### 3. Initialize Python Virtual Environment
Open a terminal inside the extracted `django_backend/` folder and initiate a clean local sandbox virtual environment:

```bash
# Create virtual environment
python -m venv venv

# Activate Virtual Environment (Windows PowerShell/CMD)
.\venv\Scripts\activate

# Activate Virtual Environment (macOS/Linux Terminal)
source venv/bin/activate
```

### 4. Install Dependencies
Run pip installer to retrieve and unpack all Django REST and Simple JWT modules defined in our dependency manifest:

```bash
pip install -r requirements.txt
```

### 5. Setup Environment Keys
If you desire to test the smart AI Multimodal Ledger Scanner, configure your Gemini API Key as an environment variable:

**macOS / Linux:**
```bash
export GEMINI_API_KEY="your-api-key-here"
```

**Windows (CMD):**
```cmd
set GEMINI_API_KEY="your-api-key-here"
```

**Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="your-api-key-here"
```

### 6. Execute Database Migration
Run the Django migration system to provision and structure tables inside the local SQLite database automatically:

```bash
python manage.py makemigrations api
python manage.py migrate
```

### 7. Create Admin Superuser
Generate administrative access to explore the database contents via the visual Django Admin Suite:

```bash
python manage.py createsuperuser
```
Follow the terminal prompts to select a username, email, and password.

### 8. Mount Development Web Server
Boot up the developmental server instance to begin accepting HTTP requests:

```bash
python manage.py runserver
```
You should see:
```text
System check identified no issues (0 silenced).
Django version 4.2.X
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

---

## 🧪 Testing the API Endpoints

Once running, you can interact with the backend API using Postman, Thunder Client, or cURL.

### 🔐 Authenticating (Procure JWT Tokens)
Send a `POST` request containing your admin credentials to receive access tokens:
- **URL**: `http://127.0.0.1:8000/api/token/`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "username": "your_username",
    "password": "your_password"
  }
  ```
- **Response**: Returns an `access` token. Add this to subsequent requests under the Authorization header: `Bearer YOUR_ACCESS_TOKEN`.

---

### 🛍️ Available Main Endpoints

*Note: All request paths are prefixed with `/api/` (e.g. `http://127.0.0.1:8000/api/customers/`).*

| Endpoint | Method | Authentication | Goal |
| :--- | :---: | :---: | :--- |
| `/api/token/` | POST | Anonymous | Request JWT access & refresh tokens |
| `/api/token/refresh/` | POST | Anonymous | Request a refreshed JWT token key |
| `/api/business-profiles/` | GET/POST | Bearer Token | Read, edit or initialize Business Designs & settings |
| `/api/customers/` | GET/POST | Bearer Token | CRUD clients, active loans, contacts & histories |
| `/api/products/` | GET/POST | Bearer Token | CRUD inventory catalog items, min units alerts |
| `/api/invoices/` | GET/POST | Bearer Token | Journal invoice ledger logs & items lists |
| `/api/suppliers/` | GET/POST | Bearer Token | CRUD supplier profiles & debts owed |
| `/api/inventory-intakes/` | GET/POST | Bearer Token | Post restocking events (automatically increments store stock) |
| `/api/notifications/` | GET | Bearer Token | Fetch warnings tracking low product quantities |
| `/api/notifications/mark-all-read/` | POST | Bearer Token | Acknowledge outstanding stock alarms |
| `/api/dashboard-metrics/` | GET | Bearer Token | Fetch sales aggregates, cash paid & aging balances |
| `/api/smart-input/` | POST | Bearer Token | Post text, files or audio to scan with Gemini AI Scanner |
