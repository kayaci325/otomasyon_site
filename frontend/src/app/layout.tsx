import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: "MindPower OS",
  description: "YouTube automation command center",
  manifest: "/manifest.json",
  applicationName: "MindPower OS",
  appleWebApp: {
    capable: true,
    title: "MindPower OS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A1628",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ToastProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 md:ml-64 p-4 md:p-6 pb-24 md:pb-6">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
