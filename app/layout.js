import { Montserrat } from "next/font/google";
import "./globals.css";

// CSS was already asking for 'Montserrat' by name but nothing was ever loading it,
// so every screen was silently falling back to system UI fonts. This actually
// loads the weights the CSS uses (500/600/700/800/900) and exposes them as a
// CSS variable so globals.css can reference --font-montserrat.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata = {
  title: "Buzz-In Live",
  description: "Real-time team buzzer quiz",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Buzz-In Live",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover", // lets us pad around iPhone notches/home indicator
  themeColor: "#3d1685",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
