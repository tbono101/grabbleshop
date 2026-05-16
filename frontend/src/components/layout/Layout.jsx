import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
