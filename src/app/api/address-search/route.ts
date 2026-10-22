import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorizedAny } from "@/lib/auth/api-guard";
import { countryOptions } from "@/lib/country-options";

type PhotonFeature = {
  properties?: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    suburb?: string;
    city?: string;
    county?: string;
    state_district?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countrycode?: string;
    type?: string;
    osm_key?: string;
    osm_value?: string;
  };
};

export async function GET(request: Request) {
  const guard = await authorizedAny([
    Permission.MANAGE_SETTINGS,
    Permission.CREATE_SALES,
    Permission.CREATE_PURCHASES,
  ]);
  if ("response" in guard) return guard.response;

  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const countryCode = params.get("country")?.toUpperCase() ?? "";
  const country = countryOptions.find((option) => option.code === countryCode);
  if (query.length < 3 || query.length > 180 || !country) {
    return NextResponse.json({ suggestions: [] });
  }

  const search = new URL("https://photon.komoot.io/api/");
  search.searchParams.set("q", query);
  search.searchParams.set("countrycode", countryCode);
  search.searchParams.set("limit", "8");
  search.searchParams.set("lang", "en");

  try {
    const response = await fetch(search, {
      headers: { Accept: "application/json", "User-Agent": "StockPilot address suggestions" },
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ suggestions: [] });

    const result = await response.json() as { features?: PhotonFeature[] };
    const mapped = (result.features ?? [])
      .filter((feature) => !feature.properties?.countrycode || feature.properties.countrycode.toUpperCase() === countryCode)
      .filter((feature) => !["state", "country", "county"].includes((feature.properties?.type ?? "").toLowerCase()))
      .map((feature) => {
        const address = feature.properties ?? {};
        const primary = ([address.housenumber, address.street].filter(Boolean).join(" ") || address.name || "").replace(/\b[a-z]/g, (c) => c.toUpperCase());
        const district = address.city ?? address.district ?? "";
        const districtPart = district && district.toLowerCase() !== primary.toLowerCase()
          ? district.replace(/\s+district$/i, "")
          : "";
        const localCandidate = address.locality ?? address.suburb ?? (address.district && address.district !== address.city ? address.district : "") ?? "";
        let localPart = localCandidate.replace(/\s+district$/i, "").trim().replace(/\b[a-z]/g, (c) => c.toUpperCase());
        if (localPart) {
          const pl = primary.toLowerCase();
          const ll = localPart.toLowerCase();
          const dl = districtPart.toLowerCase();
          if (pl && (ll === pl || pl.includes(ll) || ll.includes(pl) || (dl && (ll === dl || dl.includes(ll) || ll.includes(dl))))) localPart = "";
        }
        const parts = [...new Set([primary, localPart, address.postcode, districtPart].filter((part): part is string => Boolean(part?.trim())))];
        return {
          id: `${address.osm_type ?? "place"}-${address.osm_id ?? parts.join("-")}`,
          label: parts.join(", "),
        };
      })
      .filter((suggestion) => suggestion.label.length > 0);
    const seen = new Set<string>();
    const suggestions = mapped
      .filter((suggestion) => {
        const key = suggestion.label.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
    return NextResponse.json({ suggestions });
  } catch {
    // Address completion is optional; users can always type an address manually.
    return NextResponse.json({ suggestions: [] });
  }
}
