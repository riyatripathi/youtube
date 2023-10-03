import http from "k6/http";
import { sleep, check } from "k6";
import { Rate } from "k6/metrics";

export let options = {
  stages: [
    { duration: "1m", target: "6000", rps: "100" }, // Reset
  ],
};

export let errorRate = new Rate("errors");

export default function () {
  // Make an HTTP request to your target URL
  let response = http.get("https://sotrendzy.store/products?page=0"); // Replace with your website's URL
  // let response = http.get("https://beebom.store");

  // Check for expected response status code
  let success = check(response, {
    "Status is 200": (r) => r.status === 200,
  });

  errorRate.add(!success);

  // Sleep for a short duration (e.g., 1 second)
  sleep(1);
}

// SELECT sum("value") FROM "http_req_failed" WHERE $timeFilter GROUP BY time($__interval), "status" fill(none)
