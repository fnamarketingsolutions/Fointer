const stripSlash = (value) => String(value || "").trim().replace(/\/$/, "");

export const getAllowedOrigins = () => {
  const envFrontendOrigin = stripSlash(process.env.FRONTEND_URL);
  const extra = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map(stripSlash)
    .filter(Boolean);
  const isProd = process.env.NODE_ENV === "production";

  return [
    ...new Set(
      [
        envFrontendOrigin,
        ...extra,
        "https://fointer.vercel.app",
        !isProd ? "http://localhost:5173" : "",
        !isProd ? "http://localhost:5174" : "",
      ].filter(Boolean)
    ),
  ];
};
