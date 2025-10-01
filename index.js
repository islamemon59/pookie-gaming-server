// Import express
const express = require("express");
const app = express();
const cors = require("cors")
const port = process.env.PORT || 5000

// Middleware to parse JSON requests
app.use(express.json());
app.use(cors())

// Basic route
app.get("/", (req, res) => {
  res.send("Hello, Express Server is running!");
});

// Example POST route
app.post("/data", (req, res) => {
  const data = req.body;
  res.json({ message: "Data received successfully", data });
});

// Server listen on port 5000
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
