import { NextRequest } from "next/server";
import { withLicenseRequest } from "@/lib/license-route-helpers";
import { activateLicense } from "@/lib/license-service";

export async function POST(request: NextRequest) {
  return withLicenseRequest(request, (input, ip) =>
    activateLicense({
      licenseKey: input.license_key,
      productSlug: input.product_id,
      siteUrl: input.site_url,
      ip,
    }),
  );
}
