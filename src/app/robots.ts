import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/setup", "/guide"],
        disallow: ["/api/", "/settings", "/activity", "/reports"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
