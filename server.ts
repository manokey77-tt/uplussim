import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Logging middleware to see incoming requests in logs
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  const distPath = path.join(process.cwd(), 'dist');
  
  // Serve static files from dist
  app.use(express.static(distPath));

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Fallback to index.html for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Started successfully on http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] Serving static files from: ${distPath}`);
  });
}

startServer();
