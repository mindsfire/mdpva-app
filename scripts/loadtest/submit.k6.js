/**
 * Load test for the real member-application submit path
 * (submitApplicationAction, via the gated /api/loadtest/submit wrapper).
 *
 * Prereqs:
 *   1. Create a disposable Neon branch, point .env.local's DATABASE_URL at it.
 *   2. npx tsx scripts/loadtest/seed.ts --count 200
 *   3. Deploy that branch's env to a Vercel preview, with LOADTEST_KEY set.
 *   4. k6 run -e BASE_URL=https://<preview>.vercel.app -e LOADTEST_KEY=... scripts/loadtest/submit.k6.js
 *
 * Cleanup after: npx tsx scripts/loadtest/seed.ts --clean
 */
import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const LOADTEST_KEY = __ENV.LOADTEST_KEY;
const VERCEL_BYPASS = __ENV.VERCEL_BYPASS;
if (!LOADTEST_KEY) {
  throw new Error("Set -e LOADTEST_KEY=<value of LOADTEST_KEY on the preview deployment>");
}
if (!VERCEL_BYPASS) {
  throw new Error("Set -e VERCEL_BYPASS=<Protection Bypass for Automation secret> — without it every request 302s to Vercel's SSO wall");
}

// SharedArray loads sessions.json once and shares it read-only across VUs.
const sessions = new SharedArray("sessions", function () {
  return JSON.parse(open("./sessions.json"));
});

const photo = open("./fixture.webp", "b");

export const options = {
  scenarios: {
    event_burst: {
      // Each real member submits exactly once — per-vu-iterations models
      // that directly, instead of ramping-vus looping the same session
      // repeatedly and hitting the app's real one-application-per-member
      // rule on every iteration after the first.
      executor: "per-vu-iterations",
      vus: 150,
      iterations: 1,
      maxDuration: "60s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"],
  },
};

export default function () {
  // Each VU gets its own seeded member/session — a real member can only
  // submit once (see canResubmit), so reusing one across iterations would
  // just produce "already_pending" after the first hit, not a load result.
  const s = sessions[__VU % sessions.length];

  const payload = {
    firstName: "LoadTest",
    lastName: "Tester",
    phone: `9${String(700000000 + __VU).slice(0, 9)}`,
    email: `loadtest${__VU}@example.com`,
    addressLine1: `${__VU} Test Road`,
    addressLine2: "",
    area: "Vijayanagar",
    pincode: "570001",
    city: "Mysuru",
    state: "Karnataka",
    profession: "photographer",
    professionOther: "",
    businessName: "",
    dob: "1990-01-01",
    bloodGroup: "O+",
    aadhaar: s.aadhaar,
    photo: http.file(photo, "fixture.webp", "image/webp"),
  };

  const res = http.post(`${BASE_URL}/api/loadtest/submit`, payload, {
    headers: {
      "x-loadtest-key": LOADTEST_KEY,
      "x-vercel-protection-bypass": VERCEL_BYPASS,
      Cookie: `mdpva_onboard=${s.cookie}`,
    },
  });

  check(res, {
    "status 200": (r) => r.status === 200,
    "ok: true": (r) => {
      try {
        return JSON.parse(r.body).ok === true;
      } catch {
        return false;
      }
    },
  });
}
