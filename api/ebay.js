// DropSync eBay Backend — Deploy to Vercel (free)
// Handles: OAuth login, token refresh, push listings, get orders, reprice

const https = require("https");

// ─── CONFIG (set these in Vercel Environment Variables) ──────────────────────
const CLIENT_ID     = process.env.EBAY_CLIENT_ID;     // Your App ID from developer.ebay.com
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET; // Your Cert ID
const REDIRECT_URI  = process.env.EBAY_REDIRECT_URI;  // e.g. https://your-app.vercel.app/api/ebay?action=callback
const MARKETPLACE   = process.env.EBAY_MARKETPLACE || "EBAY_US";

// Token store (in production use a database — for now uses in-memory per-session)
let storedToken = null;

// ─── CORS HELPER ─────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ─── HTTP HELPER ─────────────────────────────────────────────────────────────
function apiCall(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { action } = req.query;

  // ── 1. GET AUTH URL ─────────────────────────────────────────────────────────
  // Call: GET /api/ebay?action=auth_url
  // Returns a URL — open it in the browser to log in
  if (action === "auth_url") {
    const scopes = [
      "https://api.ebay.com/oauth/api_scope",
      "https://api.ebay.com/oauth/api_scope/sell.inventory",
      "https://api.ebay.com/oauth/api_scope/sell.account",
      "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
      "https://api.ebay.com/oauth/api_scope/sell.marketing",
    ].join("%20");

    const url =
      `https://auth.ebay.com/oauth2/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${scopes}` +
      `&prompt=login`;

    res.json({ url });
    return;
  }

  // ── 2. OAUTH CALLBACK ───────────────────────────────────────────────────────
  // eBay redirects here after user logs in: /api/ebay?action=callback&code=xxx
  if (action === "callback") {
    const { code } = req.query;
    if (!code) { res.status(400).json({ error: "No code received from eBay" }); return; }

    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    const body = `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    const result = await apiCall({
      hostname: "api.ebay.com",
      path: "/identity/v1/oauth2/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
    }, body);

    if (result.status === 200) {
      storedToken = {
        access_token:  result.body.access_token,
        refresh_token: result.body.refresh_token,
        expires_at:    Date.now() + result.body.expires_in * 1000,
      };
      // Redirect back to the DropSync app with success
      res.writeHead(302, { Location: "/?ebay=connected" });
      res.end();
    } else {
      res.status(400).json({ error: "Token exchange failed", details: result.body });
    }
    return;
  }

  // ── 3. REFRESH TOKEN ────────────────────────────────────────────────────────
  async function getValidToken() {
    if (!storedToken) throw new Error("Not authenticated — please log in first");
    if (Date.now() < storedToken.expires_at - 60000) return storedToken.access_token;

    // Token expired — refresh it
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    const body = `grant_type=refresh_token&refresh_token=${storedToken.refresh_token}`;
    const result = await apiCall({
      hostname: "api.ebay.com",
      path: "/identity/v1/oauth2/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
    }, body);

    if (result.status === 200) {
      storedToken.access_token = result.body.access_token;
      storedToken.expires_at   = Date.now() + result.body.expires_in * 1000;
      return storedToken.access_token;
    }
    throw new Error("Token refresh failed — please log in again");
  }

  // ── 4. PUSH LISTING ─────────────────────────────────────────────────────────
  // POST /api/ebay?action=push_listing
  // Body: { sku, title, description, price, quantity, imageUrl, condition }
  if (action === "push_listing" && req.method === "POST") {
    try {
      const token = await getValidToken();
      const { sku, title, description, price, quantity, imageUrl, condition = "NEW" } = req.body;

      // Step 1 — Create inventory item
      const itemResult = await apiCall({
        hostname: "api.ebay.com",
        path: `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Language": "en-US",
        },
      }, JSON.stringify({
        product: {
          title,
          description: description || title,
          imageUrls: imageUrl ? [imageUrl] : [],
        },
        condition,
        availability: {
          shipToLocationAvailability: { quantity: quantity || 1 },
        },
      }));

      if (itemResult.status !== 204 && itemResult.status !== 200) {
        return res.status(400).json({ error: "Failed to create inventory item", details: itemResult.body });
      }

      // Step 2 — Create offer
      const offerResult = await apiCall({
        hostname: "api.ebay.com",
        path: "/sell/inventory/v1/offer",
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Language": "en-US",
        },
      }, JSON.stringify({
        sku,
        marketplaceId: MARKETPLACE,
        format: "FIXED_PRICE",
        listingDescription: description || title,
        pricingSummary: {
          price: { value: price.toFixed(2), currency: "USD" },
        },
        quantityLimitPerBuyer: 10,
        listingPolicies: {
          fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID || "",
          paymentPolicyId:     process.env.EBAY_PAYMENT_POLICY_ID     || "",
          returnPolicyId:      process.env.EBAY_RETURN_POLICY_ID      || "",
        },
        categoryId: process.env.EBAY_DEFAULT_CATEGORY || "11700", // General merchandise
      }));

      if (offerResult.status !== 200 && offerResult.status !== 201) {
        return res.status(400).json({ error: "Failed to create offer", details: offerResult.body });
      }

      const offerId = offerResult.body.offerId;

      // Step 3 — Publish offer (makes it live on eBay)
      const publishResult = await apiCall({
        hostname: "api.ebay.com",
        path: `/sell/inventory/v1/offer/${offerId}/publish`,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }, "{}");

      if (publishResult.status === 200) {
        res.json({ success: true, listingId: publishResult.body.listingId, offerId });
      } else {
        res.status(400).json({ error: "Publish failed", details: publishResult.body });
      }
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
    return;
  }

  // ── 5. UPDATE PRICE ─────────────────────────────────────────────────────────
  // POST /api/ebay?action=update_price
  // Body: { offerId, price }
  if (action === "update_price" && req.method === "POST") {
    try {
      const token = await getValidToken();
      const { offerId, price } = req.body;

      const result = await apiCall({
        hostname: "api.ebay.com",
        path: `/sell/inventory/v1/offer/${offerId}`,
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Language": "en-US",
        },
      }, JSON.stringify({
        pricingSummary: {
          price: { value: price.toFixed(2), currency: "USD" },
        },
      }));

      res.json({ success: result.status === 204, status: result.status });
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
    return;
  }

  // ── 6. GET ORDERS ───────────────────────────────────────────────────────────
  // GET /api/ebay?action=orders
  if (action === "orders") {
    try {
      const token = await getValidToken();
      const result = await apiCall({
        hostname: "api.ebay.com",
        path: "/sell/fulfillment/v1/order?limit=50&filter=orderfulfillmentstatus:%7BNOT_STARTED%7C%7DIN_PROGRESS%7D",
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (result.status === 200) {
        const orders = result.body.orders.map((o) => ({
          id:       o.orderId,
          buyer:    o.buyer?.username || "Unknown",
          total:    parseFloat(o.pricingSummary?.total?.value || 0),
          status:   o.orderFulfillmentStatus,
          date:     o.creationDate,
          items:    o.lineItems.map((li) => ({
            title:    li.title,
            sku:      li.sku,
            qty:      li.quantity,
            price:    parseFloat(li.lineItemCost?.value || 0),
          })),
        }));
        res.json({ orders, total: result.body.total });
      } else {
        res.status(400).json({ error: "Failed to fetch orders", details: result.body });
      }
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
    return;
  }

  // ── 7. CHECK CONNECTION STATUS ──────────────────────────────────────────────
  // GET /api/ebay?action=status
  if (action === "status") {
    if (!storedToken) {
      res.json({ connected: false });
    } else {
      res.json({ connected: true, expires_at: storedToken.expires_at });
    }
    return;
  }

  res.status(400).json({ error: `Unknown action: ${action}. Use: auth_url, callback, push_listing, update_price, orders, status` });
};
