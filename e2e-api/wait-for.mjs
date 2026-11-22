// Waits until a URL responds (used to start the frontend build after the API is up).
const url = process.argv[2];
const deadline = Date.now() + 60_000;
for (;;) {
  try {
    const response = await fetch(url);
    if (response.ok) break;
  } catch {
    // Not up yet.
  }
  if (Date.now() > deadline) {
    console.error(`Timed out waiting for ${url}`);
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
