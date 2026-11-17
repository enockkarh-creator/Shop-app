const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017");
let db;
const names = {}; // real collection names found in MongoDB

// s = text, n = number, a = list (array)
const fields = {
  products: { name: "s", price: "n", stock: "n", category: "s" },
  customers: { name: "s", email: "s", city: "s" },
  orders: { customer_email: "s", date: "s", items: "a", total: "n", status: "s" },
};

const clean = (kind, b) => {
  const out = {};
  for (const [f, t] of Object.entries(fields[kind])) {
    if (t === "n") out[f] = Number(b[f]);
    else if (t === "a") out[f] = Array.isArray(b[f]) ? b[f] : [];
    else out[f] = String(b[f]);
  }
  return out;
};

const safe = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
};

app.param("kind", (req, res, next, kind) =>
  fields[kind] ? next() : res.status(404).json({ error: "Unknown collection" }));

const col = (kind) => db.collection(names[kind]);

// READ
app.get("/api/:kind", safe(async (req, res) => {
  res.json(await col(req.params.kind).find().toArray());
}));

// CREATE
app.post("/api/:kind", safe(async (req, res) => {
  const r = await col(req.params.kind).insertOne(clean(req.params.kind, req.body));
  res.json({ insertedId: r.insertedId });
}));

// UPDATE
app.put("/api/:kind/:id", safe(async (req, res) => {
  await col(req.params.kind).updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: clean(req.params.kind, req.body) }
  );
  res.json({ ok: true });
}));

// DELETE
app.delete("/api/:kind/:id", safe(async (req, res) => {
  await col(req.params.kind).deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ ok: true });
}));

async function start() {
  await client.connect();
  db = client.db("Shop");
  const existing = await db.listCollections().toArray();
  for (const kind of Object.keys(fields)) {
    const found = existing.find((c) => c.name.toLowerCase() === kind);
    names[kind] = found ? found.name : kind;
  }
  console.log("Collections used:", names);
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log("Server running on port " + port + " - open http://localhost:" + port));
}
start().catch((err) => console.error("Could not connect to MongoDB:", err.message));
