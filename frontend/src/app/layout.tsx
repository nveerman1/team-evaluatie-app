import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Evaluatie App",
  description: "Evaluatie applicatie voor teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
