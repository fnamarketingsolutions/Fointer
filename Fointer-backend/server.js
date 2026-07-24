import "dotenv/config";
import express from "express";
import cors from "cors";
import dns from "dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import authRoute from "./routes/authRoute.js";
import dashboardRoute from "./routes/dashboardRoute.js";
import communityRoute from "./routes/communityRoute.js";

const app = express();
const PORT = process.env.PORT;
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://fointer.vercel.app",
  "https://punctual-droop-viper.ngrok-free.dev",
  
];

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use("/api/auth", authRoute);
app.use("/api", dashboardRoute);
app.use("/api/communities", communityRoute);

connectDB();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
