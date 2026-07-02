# Isaiah Amos Portfolio — Project Documentation

**Stack:** HTML · CSS · JavaScript · Node.js · Express · MongoDB  
**Purpose:** Personal portfolio website with a private CMS to add, edit, and delete client projects.

---

## Project Structure

```
isaiah-portfolio/
├── public/                   ← Everything the browser sees
│   ├── index.html            ← Portfolio homepage
│   ├── css/
│   │   └── style.css         ← All styles (brand tokens + layout)
│   ├── js/
│   │   └── main.js           ← Frontend JS (nav, projects fetch, contact form)
│   ├── img/                  ← Your personal images (copy from original portfolio)
│   └── admin/
│       ├── login.html        ← Admin login page
│       └── dashboard.html    ← Admin project manager
├── routes/
│   ├── public.js             ← Public API: GET /api/projects, POST /api/contact
│   └── admin.js              ← Protected API: login, logout, project CRUD
├── models/
│   ├── Project.js            ← MongoDB schema for projects
│   └── ContactMessage.js     ← MongoDB schema for contact form submissions
├── uploads/
│   └── projects/             ← Uploaded project images (auto-created)
├── server.js                 ← Express app entry point
├── package.json
├── .env.example              ← Template for your environment variables
└── .gitignore
```

---

## How to Set Up (Termux / Acode)

### Step 1 — Install Node.js and MongoDB

In Termux:

```bash
pkg update && pkg upgrade
pkg install nodejs mongodb
```

### Step 2 — Copy project files

Put the project folder inside termux home directory.

```bash
cp -r ~/storage/downloads/isaiah-portfolio ~/
cd ~/isaiah-portfolio
```

### Step 3 — Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` in Acode and fill in your values:

```
MONGO_URI=mongodb://127.0.0.1:27017/isaiah_portfolio
SESSION_SECRET=paste_a_long_random_string_here
ADMIN_USERNAME=isaiah_admin
ADMIN_PASSWORD=YourStrongPassword123!
```

To generate a secure SESSION_SECRET, run this in Termux:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output and paste it as your SESSION_SECRET.

### Step 4 — Install dependencies

```bash
npm install
```

### Step 5 — Copy your images

Copy your personal photos into `public/img/`:

```bash
cp /path/to/isaiah-amos.png public/img/
cp /path/to/isaiah-amos-tizhe-hero.png public/img/
```

### Step 6 — Start MongoDB

```bash
mongod --dbpath ~/mongodb-data &
```

### Step 7 — Start the server

```bash
npm start
```

Visit `http://localhost:3000` in your browser.

---

## API Reference

### Public Endpoints

| Method | Endpoint        | Description                  |
| ------ | --------------- | ---------------------------- |
| GET    | `/api/projects` | Returns all projects (JSON)  |
| POST   | `/api/contact`  | Saves a contact form message |

### Admin Endpoints (require login)

| Method | Endpoint                  | Description                           |
| ------ | ------------------------- | ------------------------------------- |
| POST   | `/admin/login`            | Log in with username + password       |
| POST   | `/admin/logout`           | Log out, destroy session              |
| GET    | `/admin/me`               | Returns logged-in username            |
| POST   | `/admin/api/projects`     | Add a new project (with image upload) |
| PUT    | `/admin/api/projects/:id` | Edit an existing project              |
| DELETE | `/admin/api/projects/:id` | Delete a project and its image        |
| GET    | `/admin/api/messages`     | View all contact form submissions     |

---

## Admin CMS Workflow

1. Go to `http://localhost:3000/admin/login`
2. Enter your username and password from `.env`
3. You land on the **Dashboard**
4. Fill in the **Add New Project** form — title, description, category, image, and live URL
5. Click **Add Project** — it saves to MongoDB and immediately shows on the portfolio
6. To edit a project: click the **pen icon** on any row
7. To delete: click the **trash icon** and confirm

---

## Security Features

### Input security

- All user input is trimmed, validated, and sanitised on the server before being saved
- The `validator` library checks email format and URL format
- Max-length limits are enforced on every field both in the browser and the server
- MongoDB Mongoose schemas enforce data types and lengths as a third layer
- Uploaded images are type-checked (JPEG/PNG/WebP only) and size-limited to 3 MB

### Honeypot

Both the contact form and the login form include a hidden input field (`_honey`). Real users never see or fill it in. If it contains any value, the server knows a bot submitted the form and silently rejects or ignores it.

### Rate limiting

| Route               | Limit                         |
| ------------------- | ----------------------------- |
| All routes          | 200 requests / 15 min per IP  |
| POST `/api/contact` | 5 submissions / 15 min per IP |
| POST `/admin/login` | 10 attempts / 15 min per IP   |

### Session security

- Sessions are stored in MongoDB, not in memory (survives server restarts)
- The session cookie is `httpOnly` (JavaScript cannot read it) and `sameSite: lax`
- In production (`NODE_ENV=production`) the cookie is also `secure` (HTTPS only)
- The session ID is regenerated on every successful login to prevent session fixation attacks
- Sessions expire after 8 hours

### HTTP headers (Helmet)

The `helmet` middleware sets secure HTTP headers automatically, including:

- `Content-Security-Policy` — restricts where scripts/styles/images can load from
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — stops MIME sniffing

### Admin route protection

Every admin API endpoint calls `requireAuth` middleware first. If there is no valid session, the server returns a `401 Unauthorised` response and the browser redirects to the login page.

---

## Adding a New Project (Quick Reference)

1. Log in at `/admin/login`
2. Fill the form on the dashboard:
   - **Title** — project name (required)
   - **Category** — select from the dropdown
   - **Description** — brief summary (required)
   - **Image** — JPEG, PNG, or WebP, max 3 MB (required for new projects)
   - **Live URL** — link to the live site (optional)
3. Click **Add Project**
4. The project appears on the public portfolio immediately

---

## Deploying to Production

When you move from local testing to a live server:

1. Set `NODE_ENV=production` in your `.env`
2. Set `ALLOWED_ORIGIN` to your actual domain, e.g. `https://1xportalhub.com.ng`
3. Use a strong, unique `SESSION_SECRET` and `ADMIN_PASSWORD`
4. Serve the app behind HTTPS (use Nginx + Let's Encrypt, or a hosting platform)
5. Use `pm2` to keep the server running:

```bash
npm install -g pm2
pm2 start server.js --name "portfolio"
pm2 save
pm2 startup
```

---

## Troubleshooting

**Server won't start**  
Make sure MongoDB is running (`mongod`) and your `MONGO_URI` is correct in `.env`.

**Images not showing after upload**  
Check that the `uploads/projects/` folder exists and is writable.

**Login says "Invalid credentials"**  
Double-check `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`. Restart the server after any `.env` change.

**Port already in use**  
Change `PORT=3001` in `.env` or kill the process using port 3000:

```bash
lsof -i :3000
kill -9 <PID>
```

Live url: https://founder.onexportalhq.com
