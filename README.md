# FlowForge – AI-Driven Workflow Orchestration Engine

FlowForge is a workflow orchestration platform designed to create, manage, and monitor automated workflows through a visual builder, conditional branching, and AI-assisted workflow generation.

## 🚀 Live Demo

**[Open FlowForge](https://applet-udaykumar0907200635-1717s-projects.vercel.app)**

## ✨ Features

- **Visual Workflow Builder:** Design workflows using a node-based interface.
- **Conditional Branching:** Define workflow paths based on conditions.
- **AI-Assisted Generation:** Generate workflow structures from natural-language instructions.
- **Asynchronous Processing:** Manage background jobs using BullMQ and Redis.
- **Retry Handling:** Handle failed jobs with configurable retry mechanisms.
- **Execution Monitoring:** Track workflow execution status and job progress.
- **REST API Integration:** Create and manage workflows through backend APIs.
- **Database Management:** Store workflow configurations and execution data in PostgreSQL.
- **Authentication and Authorization:** Manage user access with Clerk and role-based access control.

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, TypeScript |
| Backend | Node.js, Express.js |
| Database | PostgreSQL, Prisma ORM |
| Job Queue | Redis, BullMQ |
| Authentication | Clerk |
| Deployment | Vercel |

## 🏗️ Architecture

1. Users create workflows through the visual builder.
2. Workflow definitions are sent to the backend through REST APIs.
3. The backend validates and stores workflow data in PostgreSQL using Prisma.
4. Background tasks are queued and processed using BullMQ and Redis.
5. Failed jobs can be retried according to the configured retry policy.
6. Execution status is made available for monitoring.

## ⚙️ Getting Started

### Prerequisites

- Node.js and npm
- PostgreSQL
- Redis
- Clerk account and credentials

### Installation

Clone the repository:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd flow
npm install
```

Configure the environment variables required by your application in a `.env` file. For example:

```env
DATABASE_URL=your_postgresql_connection_string
REDIS_URL=your_redis_connection_string
```

Add any Clerk keys and AI provider credentials required by your implementation. Never commit secrets or API keys to GitHub.

Run the development server using the script defined in your `package.json`:

```bash
npm run dev
```

**Note:** If the frontend and backend use separate directories, install dependencies and start each service according to its respective `package.json`.

## 🔐 Security

- Protect workflow-management endpoints with authentication and authorization.
- Store secrets in environment variables.
- Validate incoming API requests.
- Apply suitable access controls to workflow data and execution records.

## 🔮 Future Enhancements

- Scheduled and event-triggered workflows
- Workflow templates and reusable components
- Detailed execution logs and analytics
- Workflow versioning and rollback
- Team collaboration and shared workflows

## 👨‍💻 Author

**Uday Kumar**

- GitHub: [udaykumar09072006](https://github.com/udaykumar09072006)
- LinkedIn: [Uday Kumar](https://linkedin.com/in/uday-kumar-08934628b)
- LeetCode: [udaykumar09072006](https://leetcode.com/u/udaykumar09072006/)

## 📄 License

This project is available for educational and portfolio purposes. Add a specific open-source license if you intend to distribute it under one.
