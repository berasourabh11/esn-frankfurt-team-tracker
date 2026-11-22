// Cloudflare adapter settings (https://opennext.js.org/cloudflare).
// No persistent incremental cache: pages that read events re-fetch them from
// the API (cached for a few minutes in memory), which keeps everything on the
// free plan without R2 storage.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
