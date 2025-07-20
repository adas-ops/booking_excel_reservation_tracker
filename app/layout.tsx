import type { Metadata } from 'next'
import './globals.css'
<<<<<<< HEAD
import { ThemeProvider } from '../components/theme-provider'

export const metadata: Metadata = {
  title: 'Booking & Payment Tracker',
  description: 'Created by adas-ops',
=======

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
>>>>>>> fa34384e1cef5292bbb0845ec029f08b83676c9b
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
<<<<<<< HEAD
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
=======
      <body>{children}</body>
>>>>>>> fa34384e1cef5292bbb0845ec029f08b83676c9b
    </html>
  )
}
