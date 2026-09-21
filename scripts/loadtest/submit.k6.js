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
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const LOADTEST_KEY = __ENV.LOADTEST_KEY;
if (!LOADTEST_KEY) {
  throw new Error("Set -e LOADTEST_KEY=<value of LOADTEST_KEY on the preview deployment>");
}

// SharedArray loads sessions.json once and shares it read-only across VUs.
const sessions = new SharedArray("sessions", function () {
  return JSON.parse(open("./sessions.json"));
});

const photo = open("./fixture.webp", "b");

export const options = {
  scenarios: {
    event_burst: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: 150 }, // ramp to peak concurrency
        { duration: "45s", target: 150 }, // hold — simulates the event window
        { duration: "10s", target: 0 },   // ramp down
      ],
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
    lastName: `User${__VU}`,
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

  sleep(1);
}
