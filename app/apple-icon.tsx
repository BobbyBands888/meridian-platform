import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1F4D3A" }}>
        <svg width="120" height="120" viewBox="0 0 64 64">
          <path d="M14 31 32 16l18 15v17H14z" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinejoin="round" />
          <rect x="27" y="36" width="10" height="12" fill="#D97A3A" />
        </svg>
      </div>
    ),
    size,
  );
}
