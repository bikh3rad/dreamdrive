/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // فعلاً همه‌جا <img> ساده به کار رفته، ولی اگر به next/image مهاجرت
    // کردی دامنهٔ انبارهٔ فایل باید اینجا باشد وگرنه تصویر رندر نمی‌شود.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  },
};
module.exports = nextConfig;
