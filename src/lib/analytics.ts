import db from "@/db";

export async function getAnalyticsData() {
  const platformStats = await db("post_platforms")
    .select("platform")
    .count("* as total")
    .select(db.raw("SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as successful"))
    .select(db.raw("SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed"))
    .groupBy("platform");

  const trendData = await db("posts")
    .select(db.raw("DATE(scheduled_at) as date"))
    .count("* as total")
    .where("status", "published")
    .groupBy("date")
    .orderBy("date", "asc")
    .limit(30);

  return {
    platformStats,
    trendData,
  };
}
