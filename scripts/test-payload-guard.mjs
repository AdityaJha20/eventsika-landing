import { POST as leadsPost } from "../src/app/api/leads/route.ts";
import { POST as vendorPost } from "../src/app/api/vendor-applications/route.ts";

function createMockRequest(url, headers = {}, body = null) {
  const reqHeaders = new Headers(headers);
  if (body && !reqHeaders.has("content-type")) {
    reqHeaders.set("content-type", "application/json");
  }
  return new Request(url, {
    method: "POST",
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : null,
  });
}

async function runTests() {
  console.log("=== 1. Testing Payload Size Guard (> 50KB / 51200 bytes) ===");
  
  // Test Oversized Payload on /api/leads
  const oversizedLeadsReq = createMockRequest("http://localhost:3000/api/leads", {
    "content-length": "55000",
    "x-real-ip": "10.0.0.1",
  }, { test: "oversized" });

  const leads413Res = await leadsPost(oversizedLeadsReq);
  const leads413Body = await leads413Res.json();
  console.log("Leads 413 Status:", leads413Res.status === 413 ? "PASS (413)" : `FAIL (${leads413Res.status})`);
  console.log("Leads 413 Error Message:", leads413Body.message);

  // Test Oversized Payload on /api/vendor-applications
  const oversizedVendorReq = createMockRequest("http://localhost:3000/api/vendor-applications", {
    "content-length": "60000",
    "x-real-ip": "10.0.0.2",
  }, { test: "oversized" });

  const vendor413Res = await vendorPost(oversizedVendorReq);
  const vendor413Body = await vendor413Res.json();
  console.log("Vendor 413 Status:", vendor413Res.status === 413 ? "PASS (413)" : `FAIL (${vendor413Res.status})`);
  console.log("Vendor 413 Error Message:", vendor413Body.message);

  console.log("\n=== 2. Testing Normal / Small Payload Reaches Validation ===");
  
  // Small request (invalid fields to verify it safely enters validation and returns 400, not 413)
  const normalLeadsReq = createMockRequest("http://localhost:3000/api/leads", {
    "content-length": "250",
    "x-real-ip": "10.0.0.3",
  }, { userName: "" });

  const leads400Res = await leadsPost(normalLeadsReq);
  const leads400Body = await leads400Res.json();
  console.log("Leads Normal Status:", leads400Res.status === 400 ? "PASS (400 Validation Error)" : `FAIL (${leads400Res.status})`);
  console.log("Validation Message:", leads400Body.message);

  console.log("\n=== 3. Testing Rate Limiter (Limit 5 requests) ===");
  const spamIp = "10.0.0.99";
  for (let i = 1; i <= 5; i++) {
    const req = createMockRequest("http://localhost:3000/api/leads", {
      "content-length": "50",
      "x-real-ip": spamIp,
    }, { userName: "" });
    const res = await leadsPost(req);
    console.log(`Leads Request #${i} (IP ${spamIp}): Status = ${res.status}`);
  }

  const req6 = createMockRequest("http://localhost:3000/api/leads", {
    "content-length": "50",
    "x-real-ip": spamIp,
  }, { userName: "" });
  const res6 = await leadsPost(req6);
  const body6 = await res6.json();
  console.log("Request #6 Status:", res6.status === 429 ? "PASS (429 Too Many Requests)" : `FAIL (${res6.status})`);
  console.log("Retry-After Header:", res6.headers.get("retry-after"));
  console.log("Rate Limit Error Message:", body6.message);
}

runTests().catch(console.error);
