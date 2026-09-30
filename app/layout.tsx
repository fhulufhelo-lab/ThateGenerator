import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thate Electrical Supplies | Document Generator",
  description: "Prepare delivery notes, quotations, and invoices.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA">
      <body>{children}</body>
    </html>
  );
}