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

// Create a MongoClient with a MongoClientOptions object to set the Stable API
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("gameCollection");
    const gameDataCollection = db.collection("gameData");
    const userDataCollection = db.collection("userData");
    const adsDataCollection = db.collection("adsData");

    app.get("/total-games", async (req, res) => {
      try {
        const count = await gameDataCollection.countDocuments();
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
        const games = await gameDataCollection
          .find()
          .sort({ _id: -1 })
          .limit(50)
          .toArray();
        res.send(games);
      } catch (error) {
        res.status(500).json({ message: "Error fetching games", error });
      }
    });

    app.get("/search/games", async (req, res) => {
      try {
        const { title } = req.query;

        // If search term exists, filter by title
        const query =
          title && title.trim() !== ""
            ? { title: { $regex: title, $options: "i" } }
            : {};

        const games = await gameDataCollection
          .find(query)
          .sort({ _id: -1 }) // latest games first
          .toArray();

        res.status(200).send(games);
      } catch (error) {
        console.error("Error fetching games:", error);
        res.status(500).json({ message: "Server Error" });
      }
    });

    app.get("/categories", async (req, res) => {
      try {
        const categories = await gameDataCollection.distinct("category");
        res.json({ success: true, categories });
      } catch (error) {
        console.error(error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch categories",
          error: error.message,
        });
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

    app.get("/search", async (req, res) => {
      try {
        const { title } = req.query;
        if (!title || title.trim() === "") {
          return res
            .status(400)
            .json({ message: "Please enter a search term" });
        }
        const games = await gameDataCollection
          .find({
            title: { $regex: title, $options: "i" },
          })
          .toArray();

        res.status(200).send(games);
      } catch (error) {
        console.error("Error searching games:", error);
        res.status(500).json({ message: "Server Error" });
      }
    });

    app.post("/games", async (req, res) => {
      try {
        const game = req.body;
        game.createdAt = new Date();

        const result = await gameDataCollection.insertOne(game);
        res.status(201).send({ success: true, result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    app.get("/ads", async (req, res) => {
      try {
        const ads = await adsDataCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();
        res.send({ success: true, ads });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    app.get("/ads/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const ad = await adsDataCollection.findOne({ _id: new ObjectId(id) });

        if (!ad) {
          return res
            .status(404)
            .send({ success: false, message: "Ad not found" });
        }

        res.send({ success: true, ad });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    app.get("/games/category/:category", async (req, res) => {
      try {
        const { category } = req.params;

        if (!category) {
          return res
            .status(400)
            .json({ success: false, message: "Category is required" });
        }

        const games = await gameDataCollection
          .find({
            category: { $regex: `^${category}$`, $options: "i" },
          })
          .toArray();
        res.status(200).json({ success: true, count: games.length, games });
      } catch (error) {
        console.error("Error fetching category games:", error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch category games",
          error: error.message,
        });
      }
    });

    app.post("/ads", async (req, res) => {
      try {
        const { title, image, link, position } = req.body;

        if (!title || !image || !link || !position) {
          return res
            .status(400)
            .send({ success: false, message: "All fields are required" });
        }
        const result = await adsDataCollection.insertOne({
          title,
          image,
          link,
          position, // left, right, bottom
          createdAt: new Date(),
        });

        res.status(201).send({ success: true, ad: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Update ad
    app.put("/ads/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updateData = req.body;
        const result = await adsDataCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        res.send({ success: true, result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    app.delete("/ads/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await adsDataCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send({ success: true, result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // ✅ Save or skip duplicate user
    app.post("/users", async (req, res) => {
      try {
        const { name, email } = req.body;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const existingUser = await userDataCollection.findOne({ email });

        if (existingUser) {
          return res.send({
            message: "User already exists",
            user: existingUser,
          });
        }

        const newUser = { name, email, createdAt: new Date() };
        const result = await userDataCollection.insertOne(newUser);
        res.send({ message: "User added successfully", result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.put("/games/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updateDoc = req.body;
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
  } finally {
  }
}
run().catch(console.dir);

// Basic route
app.get("/", (req, res) => {
  res.send("Hello, Express Server is running!");
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const db = client.db("gameCollection"); // your DB name
    const gameDataCollection = db.collection("gameData");

    const games = await gameDataCollection
      .find({}, { projection: { _id: 1, title: 1, category: 1, createdAt: 1 } })
      .toArray();

    const categories = await gameDataCollection.distinct("category");
    const baseUrl = "https://innliv.com";

    // Static pages
    const staticUrls = `
      <url><loc>${baseUrl}/</loc></url>
      <url><loc>${baseUrl}/about</loc></url>
      <url><loc>${baseUrl}/contact</loc></url>
      <url><loc>${baseUrl}/privacy</loc></url>
    `;

    // Dynamic category URLs
    let categoryUrls = "";
    categories.forEach((category) => {
      categoryUrls += `
        <url>
          <loc>${baseUrl}/category/${encodeURIComponent(category)}</loc>
        </url>`;
    });

    // Dynamic game URLs
    let gameUrls = "";
    games.forEach((game) => {
      const lastmod = game.createdAt
        ? new Date(game.createdAt).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
      gameUrls += `
        <url>
          <loc>${baseUrl}/games/${game._id}</loc>
          <lastmod>${lastmod}</lastmod>
        </url>`;
    });

    // Combine everything
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${staticUrls}
        ${categoryUrls}
        ${gameUrls}
      </urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(sitemap);
  } catch (error) {
    console.error("Error generating sitemap:", error);
    res.status(500).send("Error generating sitemap");
  }
});

app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
