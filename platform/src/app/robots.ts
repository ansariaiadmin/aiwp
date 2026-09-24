import type { MetadataRoute } from "next";

/**
 * This is an internal management panel, never meant to be indexed —
 * disallow everything, for every crawler.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
