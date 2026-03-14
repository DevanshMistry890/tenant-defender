import { Playfair_Display, Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

const ibmMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata = {
  title: 'Tenant Defender | Strict-CAG Legal Evaluation',
  description: 'Empowering vulnerable renters with zero-hallucination, citation-backed legal defense against bad-faith evictions.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfair.variable} ${sourceSans.variable} ${ibmMono.variable} antialiased paper-texture`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
