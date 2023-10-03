import http from "k6/http";
import { sleep, check } from "k6";

export let options = {
  vus: 100000, // Number of Virtual Users (Users)
  duration: "60s", // Duration of the test
  rps: 1000, // Requests per second (adjust as needed)
};

export default function () {
  // Make an HTTP request to your target URL
  let response = http.get("https://sotrendzy.store/"); // Replace with your website's URL

  // Check for expected response status code
  check(response, {
    "Status is 200": (r) => r.status === 200,
  });

  // Sleep for a short duration (e.g., 1 second)
  sleep(1);
}

