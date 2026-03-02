# DropSync — Go Live with eBay
## Complete setup guide (no coding experience needed)

---

## STEP 1 — Create your free eBay Developer account (5 minutes)

1. Go to: https://developer.ebay.com/join
2. Sign in with your existing eBay account (use your seller account)
3. After signing in, go to: https://developer.ebay.com/my/keys
4. Click **"Create Application Keys"**
5. Name it: `DropSync` → Select **Production** → Click Create
6. You'll get 3 things — copy them somewhere safe:
   - **App ID (Client ID)** → looks like: `YourName-DropSync-PRD-abc123def-456`
   - **Dev ID**             → looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Cert ID (Secret)**   → looks like: `PRD-xxxxxxxxxxxxxxxx-xxxx-xxxx`

---

## STEP 2 — Create a free Vercel account (2 minutes)

1. Go to: https://vercel.com/signup
2. Sign up with GitHub (free — create a GitHub account first if you don't have one)
3. You're in — Vercel is where your backend will live

---

## STEP 3 — Upload the backend to Vercel (3 minutes)

**Option A — Drag & Drop (easiest):**
1. Go to: https://vercel.com/new
2. Click **"Upload"** (or drag the `dropsync-backend` folder)
3. Upload the entire `dropsync-backend` folder
4. Click **Deploy**
5. After deploy, you'll get a URL like: `https://dropsync-backend-abc123.vercel.app`
6. **Copy this URL** — you'll need it in the next step

**Option B — GitHub (recommended for updates):**
1. Create a GitHub repo: https://github.com/new
2. Upload the `dropsync-backend` folder files
3. Go to Vercel → Import from GitHub → Select your repo → Deploy

---

## STEP 4 — Add your eBay keys to Vercel (2 minutes)

In your Vercel project dashboard:
1. Click **Settings** → **Environment Variables**
2. Add these one by one (click "Add" after each):

   | Name                    | Value                                         |
   |-------------------------|-----------------------------------------------|
   | EBAY_CLIENT_ID          | Your App ID from Step 1                       |
   | EBAY_CLIENT_SECRET      | Your Cert ID from Step 1                      |
   | EBAY_REDIRECT_URI       | https://YOUR-VERCEL-URL.vercel.app/api/ebay?action=callback |

3. Click **Save** → Go to **Deployments** → Click **Redeploy**

---

## STEP 5 — Create your eBay RuName (redirect URL) (3 minutes)

eBay needs to know where to send users after they log in.

1. Go to: https://developer.ebay.com/my/auth → click **"User Tokens"**
2. Under **Production**, click **"Get a Token from eBay via Your Application"**
3. Click **"Add eBay Redirect URL"**
4. Fill in:
   - **Display Title**: DropSync
   - **Acceptance URL**: `https://YOUR-VERCEL-URL.vercel.app/api/ebay?action=callback`
   - **Decline URL**: `https://YOUR-VERCEL-URL.vercel.app`
5. Copy the **RuName** it gives you — add it as another environment variable in Vercel:
   - Name: `EBAY_RUNAME` · Value: the RuName string

---

## STEP 6 — Connect DropSync to your backend

Open `dropsync.html` in a text editor (Notepad, TextEdit, VS Code).

Find this line near the top of the `<script>` section:
```
const BACKEND_URL = '';
```

Change it to:
```
const BACKEND_URL = 'https://YOUR-VERCEL-URL.vercel.app';
```

Save the file. Open it in your browser. Done!

---

## STEP 7 — Click "Sign in with eBay" and you're live!

1. Open `dropsync.html` → go to **⬡ eBay Account**
2. Click **"Sign in with eBay"**
3. It opens a real eBay login page
4. Sign in with your seller account
5. eBay redirects back to DropSync — you're connected!

Now you can:
- **Push listings** from Hot Listings or WebstaurantStore → real eBay listings
- **See real orders** appear in the Orders page as they come in
- **Auto-reprice** — when you adjust the margin slider, prices update on eBay

---

## eBay Store Plan — You're on Anchor Store ✓

You're already on **Anchor Store ($299.95/mo)** — 10,000 listings and the lowest final value fee available (9.15%). DropSync is pre-configured for your plan.

To maximize your $299.95/mo investment, aim for **300+ active listings** — at that volume the fee savings vs a Basic Store cover the plan cost entirely.

---

## Common Questions

**Q: Is the Vercel backend really free?**
A: Yes — Vercel's free tier allows 100GB bandwidth and 100k function calls/month. More than enough for a dropshipping store.

**Q: What eBay listing category should I use?**
A: In the backend code, change `EBAY_DEFAULT_CATEGORY` to your category ID.
Find category IDs at: https://pages.ebay.com/sellerinformation/news/categorychanges.html

**Q: Can I test before going live?**
A: Yes — eBay has a Sandbox. Use `https://api.sandbox.ebay.com` instead of `api.ebay.com` and get sandbox keys from developer.ebay.com

**Q: How do I set up shipping/payment/return policies?**
A: In eBay Seller Hub → Account → Business Policies. Create the policies there, then add the IDs to your Vercel environment variables as:
- `EBAY_FULFILLMENT_POLICY_ID`
- `EBAY_PAYMENT_POLICY_ID`
- `EBAY_RETURN_POLICY_ID`

---

## Summary — Total time: ~15 minutes

| Step | Time  | Cost |
|------|-------|------|
| eBay Developer account | 5 min | Free |
| Vercel account | 2 min | Free |
| Deploy backend | 3 min | Free |
| Add env variables | 2 min | Free |
| Connect DropSync | 1 min | Free |
| eBay Basic Store | — | $21.95/mo |

**Total monthly cost to run DropSync live: $21.95** (just the eBay store subscription)
