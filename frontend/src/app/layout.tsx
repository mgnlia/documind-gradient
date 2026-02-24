import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DocuMind — AI Codebase Documentation',
  description: 'Instantly generate README, architecture docs, and API references for any GitHub repository using DigitalOcean Gradient AI.',
  openGraph: {
    title: 'DocuMind',
    description: 'AI-powered codebase documentation. Paste a GitHub URL, get instant docs.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0f] antialiased">
        {children}
      </body>
    </html>
  )
}
