// server.js
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const helmet = require("helmet");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const fs = require("fs");
dotenv.config();
const prerender = require("prerender-node");
const cloudinary = require("./utils/cloudinary.js");
const sendEmail = require("./utils/sendEmail");

const PORT = process.env.PORT || 3070;

// Middleware
const upload = multer({ dest: "uploads/" });
app.use(express.json());
app.use(helmet());
app.use(cors());
if (process.env.PRERENDER_TOKEN) {
  app.use(prerender.set("prerenderToken", process.env.PRERENDER_TOKEN));
}

// Mongo client
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI not set in env");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected Successfully");

    const db = client.db("gameCollection");
    const gameDataCollection = db.collection("gameData");
    const userDataCollection = db.collection("userData");
    const adsDataCollection = db.collection("adsData");
    const subscriberCollection = db.collection("subscriber");

    // total games
    app.get("/total-games", async (req, res) => {
      try {
        const count = await gameDataCollection.countDocuments();
        res.json({ totalGames: count });
      } catch (error) {
        console.error("Error /total-games:", error);
        res.status(500).json({ message: error.message });
      }
    });

    // total users
    app.get("/total-users", async (req, res) => {
      try {
        const count = await userDataCollection.countDocuments();
        res.json({ totalUsers: count });
      } catch (error) {
        console.error("Error /total-users:", error);
        res.status(500).json({ message: error.message });
      }
    });

    // get latest games (limit 50)
    app.get("/games", async (req, res) => {
      try {
        const games = await gameDataCollection
          .find()
          .sort({ _id: -1 })
          .limit(50)
          .toArray();
        res.send(games);
      } catch (error) {
        console.error("Error fetching games:", error);
        res.status(500).json({ message: "Error fetching games", error });
      }
    });

    // search games (by title, optional)
    app.get("/search/games", async (req, res) => {
      try {
        const games = await gameDataCollection
          .find()
          .sort({ _id: -1 })
          .toArray();
        res.status(200).send(games);
      } catch (error) {
        console.error("Error fetching games:", error);
        res.status(500).json({ message: "Server Error" });
      }
    });

    // categories
    app.get("/categories", async (req, res) => {
      try {
        const categories = await gameDataCollection.distinct("category");
        res.json({ success: true, categories });
      } catch (error) {
        console.error("Error /categories:", error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch categories",
          error: error.message,
        });
      }
    });

    // get game by id
    app.get("/games/:id", async (req, res) => {
      try {
        const id = req?.params?.id;
        if (!id || !ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid game id" });
        }
        const query = { _id: new ObjectId(id) };
        const game = await gameDataCollection.findOne(query);
        if (!game) return res.status(404).json({ message: "Game not found" });
        res.send(game);
      } catch (error) {
        console.error("Error fetching game:", error);
        res.status(500).json({ message: "Error fetching game", error });
      }
    });

    // generic search (requires title)
    app.get("/search", async (req, res) => {
      try {
        const { title } = req.query;
        if (!title || title.trim() === "") {
          return res
            .status(400)
            .json({ message: "Please enter a search term" });
        }
        const games = await gameDataCollection
          .find({ title: { $regex: title, $options: "i" } })
          .toArray();

        res.status(200).send(games);
      } catch (error) {
        console.error("Error searching games:", error);
        res.status(500).json({ message: "Server Error" });
      }
    });

    // add game + notify subscribers
    app.post("/games", async (req, res) => {
      try {
        const game = req.body;
        if (!game || !game.title) {
          return res
            .status(400)
            .json({ success: false, message: "Game title is required" });
        }
        game.createdAt = new Date();

        const result = await gameDataCollection.insertOne(game);

        // Fetch subscribers
        const subscribers = await subscriberCollection.find({}).toArray();

        // Send email to all subscribers (sequential — consider batching)
        for (const sub of subscribers) {
          try {
            await sendEmail(
              sub.email,
              `🎮 New Game Added: ${game.title}`,
              `
              <h2 style="color:#333;">${game.title}</h2>
              <p>Category: <strong>${
                game.category || "Unspecified"
              }</strong></p>
              ${
                game.thumbnail
                  ? `<img src="${game.thumbnail}" style="width:200px;border-radius:8px;" />`
                  : ""
              }
              <p><a href="${
                process.env.SITE_BASE_URL || "https://innliv.com/"
              }/games/${
                result.insertedId
              }" style="color:#3489BD;">Play Now</a></p>
            `
            );
          } catch (mailErr) {
            console.error("Error sending mail to", sub.email, mailErr);
            // don't fail the whole request if one mail fails
          }
        }

        res.status(201).send({ success: true, result });
      } catch (err) {
        console.error("Error adding game:", err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // subscribe
    app.post("/subscribe", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email)
          return res.status(400).send({ message: "Email is required" });

        const existing = await subscriberCollection.findOne({ email });
        if (existing)
          return res.status(400).send({ message: "Already subscribed" });

        const newSub = { email, subscribedAt: new Date() };
        await subscriberCollection.insertOne(newSub);
        res
          .status(201)
          .send({ message: "Subscribed successfully", subscriber: newSub });
      } catch (err) {
        console.error("Error /subscribe:", err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // get ads
    app.get("/ads", async (req, res) => {
      try {
        const ads = await adsDataCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();
        res.send({ success: true, ads });
      } catch (err) {
        console.error("Error /ads:", err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // get ad by id
    app.get("/ads/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!id || !ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid ad id" });
        }
        const ad = await adsDataCollection.findOne({ _id: new ObjectId(id) });

        if (!ad) {
          return res
            .status(404)
            .send({ success: false, message: "Ad not found" });
        }

        res.send({ success: true, ad });
      } catch (err) {
        console.error("Error /ads/:id:", err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // games by category
    app.get("/games/category/:category", async (req, res) => {
      try {
        const { category } = req.params;

        if (!category) {
          return res
            .status(400)
            .json({ success: false, message: "Category is required" });
        }

        const games = await gameDataCollection
          .find({ category: { $regex: `^${category}$`, $options: "i" } })
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

    // create ad
    app.post("/ads", async (req, res) => {
      try {
        const { title, type, image, link, position, content } = req.body;

        if (!title || !type || !position) {
          return res.status(400).send({
            success: false,
            message: "Title, type, and position are required",
          });
        }

        if (type === "image" && (!image || !link)) {
          return res.status(400).send({
            success: false,
            message: "Image and link are required for image ads",
          });
        }

        if (type === "code" && !content) {
          return res.status(400).send({
            success: false,
            message: "Ad code content is required for code ads",
          });
        }

        const newAd = { title, type, position, createdAt: new Date() };
        if (type === "image") {
          newAd.image = image;
          newAd.link = link;
        } else if (type === "code") {
          newAd.content = content;
        }

        const result = await adsDataCollection.insertOne(newAd);
        res.status(201).send({ success: true, ad: result.insertedId });
      } catch (err) {
        console.error("Error creating ad:", err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // update ad
    app.put("/ads/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!id || !ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid ad id" });
        }
        const updateData = req.body;
        const result = await adsDataCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        res.send({ success: true, result });
      } catch (err) {
        console.error("Error updating ad:", err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // delete ad
    app.delete("/ads/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!id || !ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid ad id" });
        }
        const result = await adsDataCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Ad not found" });
        }
        res.send({ success: true, result });
      } catch (err) {
        console.error("Error deleting ad:", err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // users (create or return existing)
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
        console.error("Error /users:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // update game
    app.put("/games/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!id || !ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid game id" });
        }
        const updateDoc = req.body;
        const result = await gameDataCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateDoc }
        );
        res.send({ success: true, result });
      } catch (err) {
        console.error("Error updating game:", err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // delete game
    app.delete("/games/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!id || !ObjectId.isValid(id)) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid game id" });
        }
        const filter = { _id: new ObjectId(id) };

        const deleteResult = await gameDataCollection.deleteOne(filter);

        if (deleteResult.deletedCount === 0) {
          return res
            .status(404)
            .json({ success: false, message: "Game not found" });
        }

        res
          .status(200)
          .json({ success: true, message: "Game deleted successfully" });
      } catch (error) {
        console.error("Error deleting game:", error);
        res.status(500).json({ success: false, message: "Server error" });
      }
    });

    // Upload API
    app.post("/upload", upload.array("images"), async (req, res) => {
      try {
        if (!req.files || req.files.length === 0) {
          return res
            .status(400)
            .json({ success: false, message: "No files uploaded" });
        }

        const urls = [];

        for (const file of req.files) {
          try {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: "pooki-uploads",
            });

            urls.push(result.secure_url);
          } catch (uploadErr) {
            console.error(
              "Cloudinary upload error for file:",
              file.path,
              uploadErr
            );
            // continue with other files instead of failing everything
          } finally {
            // try to delete local file if exists
            try {
              if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            } catch (e) {
              console.error("Error deleting temp file:", file.path, e);
            }
          }
        }

        res.status(200).json({
          success: true,
          message: "Images uploaded successfully!",
          urls,
        });
      } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({
          success: false,
          message: "Failed to upload images",
          error: error.message,
        });
      }
    });

    // sitemap route (reads DB)
    app.get("/sitemap.xml", async (req, res) => {
      try {
        const games = await gameDataCollection
          .find(
            {},
            { projection: { _id: 1, title: 1, category: 1, createdAt: 1 } }
          )
          .toArray();

        const categories = await gameDataCollection.distinct("category");
        const baseUrl = process.env.SITE_BASE_URL || "https://innliv.com";

        // Static URLs with priority
        const staticUrls = `
      <url>
        <loc>${baseUrl}/</loc>
        <priority>1.0</priority>
      </url>
      <url>
        <loc>${baseUrl}/about</loc>
        <priority>0.8</priority>
      </url>
      <url>
        <loc>${baseUrl}/contact</loc>
        <priority>0.7</priority>
      </url>
      <url>
        <loc>${baseUrl}/privacy</loc>
        <priority>0.6</priority>
      </url>
    `;

        // Dynamic category URLs
        let categoryUrls = "";
        categories.forEach((category) => {
          categoryUrls += `
        <url>
          <loc>${baseUrl}/category/${encodeURIComponent(category)}</loc>
          <priority>0.7</priority>
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
          <priority>0.5</priority>
        </url>`;
        });

        // Final sitemap XML
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

    // Basic route
    app.get("/", (req, res) => {
      res.send("Hello, Express Server is running!");
    });

    // start server AFTER routes are registered
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Unhandled error in run():", e);
  process.exit(1);
});
