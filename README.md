# 🏦 Banking App

A modern banking application built with **Next.js, React, and TypeScript**. This project explores digital banking features, account management, financial transactions, and a responsive user interface.

## ✨ Features

- 🔐 **User Authentication** — User registration and sign-in.
- 🏦 **Bank Account Management** — Connect and manage bank accounts.
- 💰 **Account Overview** — View account balances and financial summaries.
- 📊 **Transaction History** — Review banking transactions.
- 💸 **Money Transfers** — Explore fund transfer functionality.
- 📱 **Responsive Design** — User-friendly interface across different screen sizes.
- 🛡️ **Error Monitoring** — Sentry integration for error tracking.

## 🛠️ Technologies Used

- **Next.js** — React framework for web development.
- **React** — Component-based user interface.
- **TypeScript** — Type-safe JavaScript development.
- **Tailwind CSS** — Utility-first styling.
- **Appwrite** — Backend services and authentication.
- **Plaid** — Bank account connectivity.
- **Dwolla** — Payment transfer integration.
- **Sentry** — Application error monitoring.

## 🚀 Getting Started

Follow these steps to run the project locally.

### Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/)
- npm
- Git

You will also need the relevant service accounts and API credentials for any integrations you want to use.

### 1. Clone the Repository

```bash
git clone https://github.com/kklovesdaisy/Banking.git
```

### 2. Navigate to the Project Folder

```bash
cd Banking
```

If your application is inside the `banking-main` folder, run:

```bash
cd banking-main
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the directory containing `package.json`.

Add the environment variables required by your project, such as credentials for Appwrite, Plaid, Dwolla, and Sentry.

**Important:** Use your project's actual variable names and configuration values. Never commit API keys, passwords, access tokens, or other secrets to GitHub.

### 5. Start the Development Server

```bash
npm run dev
```

### 6. Open the Application

Visit the following URL in your browser:

```text
http://localhost:3000
```

## 📂 Project Structure

The project uses Next.js. Your exact folder structure may vary.

```text
Banking/
├── app/                 # Application routes and pages
├── components/          # Reusable UI components
├── lib/                 # Helper functions and services
├── public/              # Static assets
├── types/               # TypeScript type definitions
├── .env                 # Local environment variables
├── next.config.mjs      # Next.js configuration
├── package.json         # Dependencies and scripts
└── README.md            # Project documentation
```

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run linting, if configured |

## 🔒 Security Notice

- Keep environment variables and API credentials private.
- Never upload your `.env` file to GitHub.
- Use sandbox credentials when testing financial integrations.
- Do not use this project to handle real financial transactions without appropriate security reviews and authorization.

## 🎯 Project Goals

This project helps demonstrate practical experience with modern web development, reusable React components, TypeScript, API integrations, authentication, and financial application workflows.

## 👩‍💻 Developer

**Htet Nandar Winn**

IT Student | Aspiring Web Developer

- GitHub: [@kklovesdaisy](https://github.com/kklovesdaisy)
- Project Repository: [Banking](https://github.com/kklovesdaisy/Banking)

---

⭐ If you find this project interesting, feel free to explore the repository!
