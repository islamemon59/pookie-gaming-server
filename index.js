const { MongoClient, ServerApiVersion } = require("mongodb");
// Import express
const express = require("express");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const port = process.env.PORT || 5000;

// Middleware to parse JSON requests
app.use(express.json());
app.use(cors());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("gameCollection");
    const gameDataCollection = db.collection("gameData");

    app.get("/games", async (req, res) => {
      try {
        const games = await gameDataCollection.find().toArray();
        res.json(games);
      } catch (error) {
        res.status(500).json({ message: "Error fetching games", error });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

// Basic route
app.get("/game", (req, res) => {
  res.send("Hello, Express Server is running!");
});

// Example POST route
app.post("/data", (req, res) => {
  const data = req.body;
  res.json({ message: "Data received successfully", data });
});

app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
