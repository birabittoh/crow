export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { processScheduledPosts } = await import("./lib/publisher");

    // Run every minute
    setInterval(async () => {
      try {
        await processScheduledPosts();
      } catch (error) {
        console.error("Error in background worker:", error);
      }
    }, 60000);

    console.log("Background worker started");
  }
}
