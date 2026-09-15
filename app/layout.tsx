import type { Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@/components/analytics";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#1f4d3a",
};

// Runs before first paint so a banner dismissed earlier in this browser session stays hidden.
const bannerScript = `try{if(sessionStorage.getItem("nb-legal-dismissed")){document.documentElement.setAttribute("data-legal-dismissed","")}}catch(e){}`;

// The document shell shared by every market site and the Ownvista hub. Branding, header, and footer live in
// app/[market]/layout.tsx and app/hub/layout.tsx.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bannerScript }} />
      </head>
      <body className="flex min-h-dvh flex-col font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
