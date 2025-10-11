const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const userDataCollection = db.collection("userData");

    app.get("/total-games", async (req, res) => {
      try {
        const count = await gameDataCollection.countDocuments();
        console.log(count);
        res.json({ totalGames: count });
      } catch (error) {
        res.send(500).json({ message: error.message });
      }
    });
    app.get("/total-users", async (req, res) => {
      try {
        const count = await userDataCollection.countDocuments();
        res.json({ totalUsers: count });
      } catch (error) {
        res.send(500).json({ message: error.message });
      }
    });

    app.get("/games", async (req, res) => {
      try {
        const games = await gameDataCollection.find().toArray();
        res.send(games);
      } catch (error) {
        res.status(500).json({ message: "Error fetching games", error });
      }
    });

    app.get("/games/:id", async (req, res) => {
      try {
        id = req?.params?.id;
        const query = { _id: new ObjectId(id) };
        const game = await gameDataCollection.findOne(query);
        res.send(game);
      } catch (error) {
        res.status(500).json({ message: "Error fetching game", error });
      }
    });

    app.post("/games", async (req, res) => {
      try {
        const game = req.body;

        const result = await gameDataCollection.insertOne(game);
        res.status(201).send({ success: true, result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    app.put("/games/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updateDoc = req.body;
        console.log(id, updateDoc);
        const result = await gameDataCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateDoc }
        );
        res.send({ success: true, result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    app.delete("/games/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const filter = { _id: new ObjectId(id) };

        const deleteGame = await gameDataCollection.deleteOne(filter);

        if (!deleteGame) {
          return res
            .send(404)
            .json({ success: false, message: "Game not found" });
        }

        res
          .send(200)
          .json({ success: true, message: "Game deleted successfully" });
      } catch (error) {
        console.error("Error deleting game:", error);
        res.send(500).json({ success: false, message: "Server error" });
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
app.get("/", (req, res) => {
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
