import axios from "axios";
import { headers } from "next/headers";

export interface AutheliaUserInfo {
  display_name: string;
  emails: string[];
  method: string;
}

export async function getAutheliaUserInfo(): Promise<AutheliaUserInfo | null> {
  // In a real scenario, the Next.js server might be behind the same proxy as Authelia
  // and can access it via a relative URL or a specific internal URL.
  // We'll use an environment variable for the Authelia URL.
  const autheliaUrl = process.env.AUTHELIA_URL || "http://authelia:9091";

  try {
    // We should forward cookies/headers if we are proxying
    const headerList = await headers();
    const cookie = headerList.get("cookie");

    const response = await axios.get(`${autheliaUrl}/api/user/info`, {
      headers: {
        ...(cookie && { Cookie: cookie }),
      },
      timeout: 2000,
    });

    if (response.data.status === "OK") {
      return response.data.data;
    }
    return null;
  } catch (error) {
    // Optional, so just return null on failure
    return null;
  }
}
