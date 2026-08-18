const KEY = "buyforme:shared-state:v1";

function env() {
  const url = process.env.KV_REST_API_URL || process.env.STORAGE_KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.STORAGE_KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Redis environment variables are missing");
  return { url, token };
}

async function redis(command) {
  const { url, token } = env();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error(`Redis error ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const data = await redis(["GET", KEY]);
      if (!data.result) return res.status(200).json({});
      return res.status(200).json(JSON.parse(data.result));
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const allowed = new Set(["wait", "found", "done", "no", "help"]);
      const statuses = {};
      for (const [id, status] of Object.entries(body.statuses || {})) {
        if (allowed.has(status)) statuses[String(id)] = status;
      }
      const state = {
        trip: typeof body.trip === "string" ? body.trip.slice(0, 120) : "",
        statuses,
        updatedAt: new Date().toISOString()
      };
      await redis(["SET", KEY, JSON.stringify(state)]);
      return res.status(200).json({ ok: true, updatedAt: state.updatedAt });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Sync service unavailable" });
  }
}
