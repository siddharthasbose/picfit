import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME, GA_ID } from "@/lib/constants";
import Script from "next/script";

export const metadata: Metadata = {
  title: {
    template: `%s | ${SITE_NAME}`,
    default: `${SITE_NAME} - Free Govt Exam Photo & Signature Resizer`,
  },
  description:
    "Free online photo and signature resizer for Indian government exams. SSC, UPSC, IBPS, Railway, NEET, JEE, PAN, Aadhaar, Passport. 100% browser-based, private.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-neutral-950 text-neutral-200 antialiased">
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
        <header className="border-b border-neutral-800">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="font-bold text-yellow-400 text-lg">
              {SITE_NAME}
            </a>
            <nav className="flex gap-4 text-sm text-neutral-400">
              <a href="/photo-resizer" className="hover:text-neutral-200">
                Photo
              </a>
              <a href="/signature-resizer" className="hover:text-neutral-200">
                Signature
              </a>
            </nav>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>

        <footer className="border-t border-neutral-800 mt-12">
          <div className="max-w-2xl mx-auto px-4 py-6 text-center text-neutral-600 text-xs space-y-2">
            <p>
              All processing happens in your browser. We never see or store your
              photos.
            </p>
            <p>&copy; {new Date().getFullYear()} {SITE_NAME}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
