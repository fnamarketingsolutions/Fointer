/**
 * Phase 6 smoke checks for portal-separated auth.
 * Run: node scripts/smoke-auth-portals.js
 * Needs API on PORT (default 5001). Optional: SMOKE_USER_EMAIL/PASS, SMOKE_ADMIN_EMAIL/PASS
 */
const API = (process.env.SMOKE_API_URL || "http://127.0.0.1:5001/api").replace(
  /\/$/,
  ""
);

const userEmail = process.env.SMOKE_USER_EMAIL || "";
const userPass = process.env.SMOKE_USER_PASS || "";
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || "";
const adminPass = process.env.SMOKE_ADMIN_PASS || "";

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, setCookie: res.headers.getSetCookie?.() || [] };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const results = [];

  // Endpoint existence
  {
    const r = await post("/auth/login", {});
    assert(r.status === 400, `member login empty → 400, got ${r.status}`);
    results.push("OK  POST /auth/login (exists)");
  }
  {
    const r = await post("/auth/admin/login", {});
    assert(r.status === 400, `admin login empty → 400, got ${r.status}`);
    results.push("OK  POST /auth/admin/login (exists)");
  }

  if (userEmail && userPass) {
    const ok = await post("/auth/login", { email: userEmail, password: userPass });
    assert(
      ok.status === 200 && ok.data?.user?.role === "user",
      `user→member login failed: ${ok.status} ${ok.data?.message || ""}`
    );
    results.push("OK  user → member login");

    const cross = await post("/auth/admin/login", {
      email: userEmail,
      password: userPass,
    });
    assert(
      cross.status === 403 && cross.data?.code === "MEMBER_PORTAL_REQUIRED",
      `user→admin should 403 MEMBER_PORTAL_REQUIRED, got ${cross.status} ${cross.data?.code}`
    );
    assert(
      !(cross.setCookie || []).some((c) => c.startsWith("token=")),
      "user→admin must not set token cookie"
    );
    results.push("OK  user → admin login rejected");
  } else {
    results.push("SKIP user cross-login (set SMOKE_USER_EMAIL / SMOKE_USER_PASS)");
  }

  if (adminEmail && adminPass) {
    const ok = await post("/auth/admin/login", {
      email: adminEmail,
      password: adminPass,
    });
    assert(
      ok.status === 200 && ok.data?.user?.role === "admin",
      `admin→admin login failed: ${ok.status} ${ok.data?.message || ""}`
    );
    results.push("OK  admin → admin login");

    const cross = await post("/auth/login", {
      email: adminEmail,
      password: adminPass,
    });
    assert(
      cross.status === 403 && cross.data?.code === "ADMIN_PORTAL_REQUIRED",
      `admin→member should 403 ADMIN_PORTAL_REQUIRED, got ${cross.status} ${cross.data?.code}`
    );
    assert(
      !(cross.setCookie || []).some((c) => c.startsWith("token=")),
      "admin→member must not set token cookie"
    );
    results.push("OK  admin → member login rejected");
  } else {
    results.push("SKIP admin cross-login (set SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASS)");
  }

  console.log(results.join("\n"));
  console.log("\nPhase 6 auth smoke finished.");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
