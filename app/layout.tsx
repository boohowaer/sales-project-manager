import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { FontProvider } from "@/components/providers/FontProvider";
import { Poppins } from "next/font/google";

// 在 hydration 前同步应用字体设置：必须以原生 <script> 形式输出到 SSR HTML，
// 让浏览器解析到时立即执行（next/script 的 beforeInteractive 在 App Router 中不保证 paint 前执行）
const fontInitScript = `(function(){try{var s=localStorage.getItem('fontSettings');var f=s?JSON.parse(s):null;if(f&&f.fontFamily)document.documentElement.style.fontFamily=f.fontFamily;document.documentElement.style.fontSize=((f&&f.fontSize)||14)+'px';}catch(e){document.documentElement.style.fontSize='14px';}})()`

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
        <script dangerouslySetInnerHTML={{ __html: fontInitScript }} />
      </head>
      <body className={`${poppins.variable} min-h-full flex flex-col`}>
        <FontProvider>
          {children}
        </FontProvider>
        <Toaster
          position="top-center"
          gutter={10}
          toastOptions={{
            className: 'app-toast',
            duration: 2800,
            style: {
              background: '#18181b',
              color: '#fafafa',
              borderRadius: '14px',
              padding: '11px 20px',
              fontSize: '13.5px',
              fontWeight: 500,
              letterSpacing: '-0.005em',
              lineHeight: 1.4,
              minWidth: '160px',
              maxWidth: '480px',
              boxShadow:
                '0 18px 40px -12px rgba(9,7,2,0.35), 0 6px 14px -4px rgba(9,7,2,0.25), inset 0 0 0 1px rgba(255,255,255,0.06)',
            },
            success: {
              iconTheme: { primary: '#34d399', secondary: '#0b3b2e' },
            },
            error: {
              iconTheme: { primary: '#fb7185', secondary: '#3b0a14' },
            },
          }}
        />
      </body>
    </html>
  );
}
