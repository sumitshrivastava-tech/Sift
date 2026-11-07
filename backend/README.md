# Sift Backend API

> Node.js · Express · TypeScript · Prisma ORM · SQLite

A modular, fully-typed REST API backend for the **Sift** visual discovery application.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (v18+) |
| Framework | Express v5 |
| Language | TypeScript (strict) |
| ORM | Prisma v5 |
| Database | SQLite (via `prisma/dev.db`) |
| Validation | Zod |
| Auth | JWT (`jsonwebtoken`) |
| Security | Helmet, CORS |
| Logging | Morgan |

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Prisma data models
│   └── dev.db                 # SQLite database file
├── src/
│   ├── controllers/
│   │   ├── user.controller.ts
│   │   ├── post.controller.ts
│   │   ├── save.controller.ts
│   │   ├── comment.controller.ts
│   │   └── auth.controller.ts
│   ├── lib/
│   │   └── prisma.ts          # Singleton Prisma client
│   ├── middleware/
│   │   ├── validate.ts        # Generic Zod validation middleware
│   │   ├── auth.ts            # JWT authentication middleware
│   │   └── errorHandler.ts    # Central error handler
│   ├── routes/
│   │   ├── user.routes.ts
│   │   ├── post.routes.ts
│   │   ├── save.routes.ts
│   │   ├── comment.routes.ts
│   │   └── auth.routes.ts
│   ├── services/
│   │   ├── user.service.ts    # Business logic layer
│   │   ├── post.service.ts
│   │   ├── save.service.ts
│   │   ├── comment.service.ts
│   │   └── auth.service.ts
│   ├── validators/
│   │   └── schemas.ts         # All Zod schemas
│   ├── app.ts                 # Express app factory
│   └── index.ts               # Entry point + server bootstrap
├── .env
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## Data Models

### `User`
| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key |
| `username` | `String` | Unique, 3-30 chars, alphanumeric + `_` |
| `phone` | `String` | Unique, E.164 format |
| `avatar` | `String?` | Optional URL |

### `Post`
| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key |
| `authorId` | `String` | FK → User |
| `title` | `String` | Max 200 chars |
| `content` | `String` | Max 10,000 chars |
| `images` | `String` | JSON array of URLs (SQLite) |
| `tags` | `String` | JSON array of strings (SQLite) |

### `Save`
| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key |
| `userId` | `String` | FK → User |
| `postId` | `String` | FK → Post |
| ✦ | unique constraint | `(userId, postId)` pair |

### `Comment`
| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key |
| `content` | `String` | Max 2,000 chars |
| `authorId` | `String` | FK → User |
| `postId` | `String` | FK → Post |
| `createdAt` | `DateTime` | Auto-set on create |
| `updatedAt` | `DateTime` | Auto-updated |

### `OtpStore`
| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key |
| `phone` | `String` | Unique — one active OTP per phone |
| `code` | `String` | 4-digit code |
| `attempts` | `Int` | Brute-force counter |
| `expiresAt` | `DateTime` | 5-minute TTL |

---

## Getting Started

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

`.env` values:
```env
DATABASE_URL="file:./dev.db"
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=5
```

### 3. Apply Database Schema

```bash
npm run db:push
```

> This pushes the Prisma schema directly to the SQLite file (ideal for development).

### 4. Generate Prisma Client

```bash
npm run db:generate
```

### 5. Start the Development Server

```bash
npm run dev
```

The server starts with **nodemon** — any `.ts` file change triggers a hot reload.

```
✅ Database connection established
🚀 Server running on http://localhost:3000
❤️  Health check: http://localhost:3000/health
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled production build |
| `npm run db:push` | Push schema changes to SQLite (no migration history) |
| `npm run db:migrate` | Create & apply a named migration |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |

---

## API Reference

All responses follow the shape:
```json
{ "success": true, "data": { ... } }
// or on error:
{ "success": false, "message": "...", "errors": [...] }
```

### Health

```
GET /health
```

---

### Authentication (Phone OTP)

#### Send OTP
```
POST /api/auth/send-otp
```
**Body:**
```json
{ "phone": "+14155552671" }
```
**Response `200`:**
```json
{
  "success": true,
  "data": {
    "phone": "+14155552671",
    "expiresInSeconds": 300,
    "previewCode": "1234"
  }
}
```
> `previewCode` is only returned in `development` mode to facilitate testing.

#### Verify OTP & Obtain JWT
```
POST /api/auth/verify-otp
```
**Body:**
```json
{ "phone": "+14155552671", "code": "1234" }
```
**Response `200`:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "isNewUser": false,
    "user": { "id": "...", "username": "user_2671_xxxx", "phone": "+14155552671", "avatar": null }
  }
}
```

---

### Users

#### Create User
```
POST /api/users
```
**Body:**
```json
{ "username": "john_doe", "phone": "+14155552671", "avatar": "https://..." }
```

#### Get User by ID
```
GET /api/users/:id
```

---

### Posts

#### Create Post
```
POST /api/posts
```
**Body:**
```json
{
  "authorId": "clxxxxxx",
  "title": "Brutalist Staircase",
  "content": "Raw concrete with dramatic lighting.",
  "images": ["https://cdn.example.com/img1.jpg"],
  "tags": ["brutalism", "architecture"]
}
```
- `images` — array of valid URLs, max 10 items
- `tags` — array of alphanumeric strings, max 10 items

#### Get Feed
```
GET /api/posts/feed?page=1&limit=10&tag=brutalism
```

| Query Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number (≥ 1) |
| `limit` | number | `10` | Items per page (1–100) |
| `tag` | string | — | Filter posts containing this tag |

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "title": "...",
      "images": ["https://..."],
      "tags": ["brutalism"],
      "author": { "id": "...", "username": "...", "avatar": null },
      "_count": { "saves": 12, "comments": 5 }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5, "hasNextPage": true, "hasPrevPage": false }
}
```

#### Get Post by ID
```
GET /api/posts/:id
```

---

### Comments

#### Create Comment (JWT required)
```
POST /api/comments
Authorization: Bearer <token>
```
**Body:**
```json
{ "postId": "clxxxxxx", "content": "Love the raw texture!" }
```
**Response `201`:**
```json
{
  "success": true,
  "message": "Comment created successfully",
  "data": {
    "id": "...",
    "content": "Love the raw texture!",
    "createdAt": "2026-11-01T07:04:50.578Z",
    "postId": "...",
    "authorId": "...",
    "author": { "id": "...", "username": "john_doe", "avatar": null }
  }
}
```

> Also available as `POST /api/posts/:postId/comments` (postId from route param, no body field needed).

#### Get Comments for a Post
```
GET /api/posts/:postId/comments
```
Returns all comments ordered by `createdAt` ascending (oldest first), each with full author details.

---

### Saves

#### Save a Post (JWT required)
```
POST /api/saves
Authorization: Bearer <token>
```
**Body:** `{ "userId": "...", "postId": "..." }`
Returns `409` if already saved.

#### Unsave a Post (JWT required)
```
DELETE /api/saves
Authorization: Bearer <token>
```
**Body:** `{ "userId": "...", "postId": "..." }`

#### Get User's Saves
```
GET /api/saves/user/:userId
```

---

## Error Handling

| HTTP Code | Cause |
|---|---|
| `400` | Zod validation failure (field errors returned) |
| `401` | Missing or invalid JWT token |
| `404` | Resource not found |
| `409` | Unique constraint violated (e.g., duplicate save) |
| `500` | Unhandled server error |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | SQLite path e.g. `file:./dev.db` |
| `PORT` | — | Server port (default `3000`) |
| `NODE_ENV` | — | `development` / `production` |
| `JWT_SECRET` | ✅ | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | — | Token expiry (default `7d`) |
| `OTP_EXPIRY_MINUTES` | — | OTP TTL in minutes (default `5`) |
| `OTP_MAX_ATTEMPTS` | — | Max wrong OTP attempts (default `5`) |
| `CORS_ORIGIN` | — | Allowed CORS origin (default `*`) |
