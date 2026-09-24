import { NextRequest } from "next/server";
import { withLicenseRequest } from "@/lib/license-route-helpers";
import { getProductInfo } from "@/lib/license-service";

export async function POST(request: NextRequest) {
  return withLicenseRequest(request, (input) => getProductInfo(input.product_id));
}
