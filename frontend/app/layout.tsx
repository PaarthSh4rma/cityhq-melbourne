import type { Metadata } from "next";
import "./globals.css";
import "./overdrive.css";
import "./nocturne.css";
export const metadata: Metadata = {
  title: "CITYHQ — Melbourne & Delhi Intelligence",
  description:
    "A transparent urban intelligence platform for Melbourne and Delhi. City signals, explainable analytics and reproducible forecasting.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
