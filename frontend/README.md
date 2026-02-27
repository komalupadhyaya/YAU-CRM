# YAU-CRM

Enterprise-grade CRM for managing school campaigns, follow-ups, and student leads.

## Technologies Used

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **State Management**: Zustand
- **Backend**: Node.js, Express, MongoDB
- **Styling**: Tailwind CSS with custom theme support

## Features

- **3-Panel CRM Workspace**: Seamlessly manage campaigns, schools, and activities in a single view.
- **Dynamic Follow-ups**: Stay on top of your outreach with a built-in notification system.
- **Import/Export**: Easily migrate data using Excel templates.
- **Dark Mode Support**: Persistent light and dark themes for better accessibility.

## Getting Started

### Prerequisites

- Node.js (v18+)
- MongoDB (Running locally or on Atlas)

### Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd YAU
   ```

2. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   ```

3. **Install Backend Dependencies**:
   ```bash
   cd ../backend
   npm install
   ```

4. **Environment Variables**:
   Create a `.env` file in the `backend` folder:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/yau-crm
   JWT_SECRET=your_secret_key
   ```

5. **Run the Application**:
   - Backend: `npm run dev` (from `/backend`)
   - Frontend: `npm run dev` (from `/frontend`)

Access the app at `http://localhost:8080`.
