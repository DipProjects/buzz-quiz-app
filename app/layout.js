import "./globals.css";

export const metadata = {
  title: "Buzz-In Live",
  description: "Real-time team buzzer quiz",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
