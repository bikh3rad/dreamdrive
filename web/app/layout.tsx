import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthProvider } from "@/components/AuthProvider";
import { CartProvider } from "@/components/CartProvider";

export const metadata: Metadata = {
  title: "به سوی رویا — یک بلیط، یک هفته زندگی رویایی",
  description:
    "یک رقابت مهارتی نشانه‌گذاری توپ. جایزه: یک هفته ویلای لوکس و خودروی رویایی. " +
    "مسیر ورود رایگان همیشه در دسترس است.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* فونت وزیرمتن از CDN — در تولید بهتر است self-host شود */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        />
        <style>{`:root { --font-vazir: Vazirmatn, system-ui, sans-serif; }`}</style>
      </head>
      <body className="font-sans">
        <AuthProvider>
          <CartProvider>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
