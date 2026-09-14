import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default social preview for pages without their own image. Listing and vendor pages override it.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#ffffff",
          color: "#111111",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: "#1F4D3A", display: "flex" }} />
          <div style={{ fontSize: 40, fontWeight: 700, color: "#1F4D3A" }}>{site.name}</div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>{site.tagline}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: "#5b5f5d" }}>
          <div style={{ width: 48, height: 8, background: "#D97A3A" }} />
          nashvillebuys.com
        </div>
      </div>
    ),
    size,
  );
}
