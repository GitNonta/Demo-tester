import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Demo Task Board",
  description: "โปรเจกต์ Next.js สำหรับทดสอบระบบแจกงานรีวิวอัตโนมัติ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
