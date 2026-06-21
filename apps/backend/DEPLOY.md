# 🚀 Deploying the Chronos Toolbox Backend

This guide walks you through deploying the FastAPI backend securely to **Render** using Docker.

---

## Why Render?

| | Render | Railway | Fly.io |
|---|---|---|---|
| Free tier | ✅ (spins down after 15 min idle) | ✅ ($5/mo credit) | ✅ limited |
| Docker support | ✅ Native | ✅ Native | ✅ Native |
| LibreOffice (~300MB image) | ✅ Works | ✅ Works | ⚠️ Tight limits |
| Custom domain + HTTPS | ✅ Free | ✅ Free | ✅ Free |
| Cold-start time | ~30s (free tier) | ~10s | ~15s |

**Render** is the recommended choice for this project.

---

## Step 1 — Push your repo to GitHub

Make sure `apps/backend/` is committed and pushed. Verify the folder contains:

```
apps/backend/
├── main.py
├── requirements.txt
└── Dockerfile
```

---

## Step 2 — Create a Render account

Go to [https://render.com](https://render.com) and sign up (you can use your GitHub account for instant repo access).

---

## Step 3 — Create a new Web Service

1. From your Render dashboard, click **"New +"** → **"Web Service"**.
2. Connect your **GitHub** account if you haven't already.
3. Select the **`Chronos-Toolbox`** repository.
4. Configure the service:

| Setting | Value |
|---|---|
| **Name** | `chronos-toolbox-backend` (or anything you like) |
| **Region** | Choose the closest to your users |
| **Branch** | `main` |
| **Root Directory** | `apps/backend` |
| **Runtime** | **Docker** |
| **Dockerfile Path** | `./Dockerfile` |
| **Instance Type** | Free |

5. Click **"Create Web Service"**.

Render will pull your repo, build the Docker image (this takes 3–5 minutes the first time — LibreOffice is large), and start the server.

---

## Step 4 — Get your backend URL

Once deployed, Render gives you a public HTTPS URL, like:

```
https://chronos-toolbox-backend.onrender.com
```

This URL is **automatically secured with TLS (HTTPS)** — you don't have to configure anything for that.

---

## Step 5 — Update the frontend to use the live URL

In each backend-dependent tool, update the `API_URL` constant at the top of its `js/main.js`:

**`tools/pdf-to-word/js/main.js`**
```js
// Change from:
const API_URL = 'http://localhost:8000/convert/pdf-to-word';
// Change to:
const API_URL = 'https://chronos-toolbox-backend.onrender.com/convert/pdf-to-word';
```

**`tools/word-to-pdf/js/main.js`**
```js
const API_URL = 'https://chronos-toolbox-backend.onrender.com/convert/word-to-pdf';
```

**`tools/pptx-to-pdf/js/main.js`**
```js
const API_URL = 'https://chronos-toolbox-backend.onrender.com/convert/pptx-to-pdf';
```

Then commit and push. Vercel will automatically redeploy the frontend.

---

## Step 6 — Lock down CORS (important for security!)

Right now, `main.py` has `allow_origins=["*"]`, which means any website can call your API. Once deployed, restrict it to only your Vercel domain.

Edit `apps/backend/main.py`:

```python
# Replace this:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    ...
)

# With this (use your actual Vercel URL):
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://chronos-toolbox.vercel.app",  # your Vercel URL
        "http://localhost:5500",               # for local development
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)
```

Commit and push. Render will automatically redeploy.

---

## Step 7 — (Optional) Add a custom domain

If you have a domain like `api.chronostoolbox.com`:

1. In your Render service → **Settings** → **Custom Domains** → Add domain.
2. Render gives you a CNAME record to add to your DNS provider.
3. Render also automatically provisions an SSL certificate for it.

---

## ⚠️ Free Tier Limitations

On Render's free tier, the service **spins down after 15 minutes of inactivity**. The first request after a spin-down will have a ~30-second cold start (the server is booting up). 

**How to handle this on the frontend:** Show a "Waking up server, please wait…" message if the request takes longer than 5 seconds. You can detect this with a simple timeout on the fetch call.

To eliminate cold starts, upgrade to Render's **Starter plan ($7/month)**.

---

## Security Checklist

- [x] HTTPS enforced automatically by Render
- [x] CORS restricted to your Vercel domain (after Step 6)
- [x] Files are processed in temp directories and immediately deleted — nothing is stored on disk
- [x] No database, no user data, no logging of file contents
- [ ] (Optional) Add a rate limit to prevent abuse — use `slowapi` library for FastAPI
- [ ] (Optional) Add a max file size check in `main.py`
