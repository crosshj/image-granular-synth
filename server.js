require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT;

// Serve static files from the src directory
app.use(
  express.static(path.join(__dirname, "src"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".svg")) {
        res.setHeader("Content-Type", "image/svg+xml");
      }
    },
  })
);

// Default route serves index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "src", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
