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
      <head>
        {/* 在 hydration 前从 localStorage 读取字体设置，避免刷新时晃动 */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('fontSettings');if(s){var f=JSON.parse(s);if(f.fontFamily)document.documentElement.style.fontFamily=f.fontFamily;if(f.fontSize)document.documentElement.style.fontSize=f.fontSize+'px';}}catch(e){}})()`}} />
      </head>
      <body className={`${poppins.variable} min-h-full flex flex-col`}>
        <FontProvider>
          {children}
        </FontProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
