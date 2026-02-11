import { getAnalyticsData } from "@/lib/analytics";
import AnalyticsClient from "@/components/analytics-client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/" className="p-2 hover:bg-accent rounded-full transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold">Analytics</h1>
      </div>

      <AnalyticsClient data={data} />
    </div>
  );
}
