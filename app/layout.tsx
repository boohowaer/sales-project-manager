import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { FontProvider } from "@/components/providers/FontProvider";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: "销售项目管理工具",
  description: "专业的销售项目管理和任务追踪工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className={`${poppins.variable} min-h-full flex flex-col`}>
        <FontProvider>
          {children}
        </FontProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
