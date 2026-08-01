import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import logo from "../../../assets/fointer-logo.png";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact-us' },
    { name: 'Communities', href: '/communities' },
  ];

  // Prevent parent body scroll & dynamic mobile zooming when drawer is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'auto';
    }

    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'auto';
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <nav className="w-full bg-[#130D08] text-white sticky top-0 z-40 shadow-lg border-b border-[#F8A201]/10 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img
            src={logo}
            alt="Brand Logo"
            className="h-20 w-18 object-contain rounded pt-2"
          />
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="text-gray-200 text-sm font-medium transition-colors duration-200 hover:text-[#F8A201] relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-[#F8A201] hover:after:w-full after:transition-all after:duration-300"
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Desktop Buttons */}
        <div className="hidden md:flex items-center space-x-4">
          {!loading && user ? (
            <>
              <Link
                to="/dashboard"
                className="px-5 py-2 text-sm font-semibold rounded-lg border border-[#F8A201] text-[#F8A201] transition-all duration-200 hover:bg-[#F8A201] hover:text-[#130D08] active:scale-95"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-[#F8A201] text-[#130D08] transition-all duration-200 hover:bg-[#e09200] hover:shadow-md hover:shadow-[#F8A201]/20 active:scale-95"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-[#F8A201] text-[#130D08] transition-all duration-200 hover:bg-[#e09200] hover:shadow-md hover:shadow-[#F8A201]/20 active:scale-95"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-5 py-2 text-sm font-semibold rounded-lg border border-[#F8A201] text-[#F8A201] transition-all duration-200 hover:bg-[#F8A201] hover:text-[#130D08] active:scale-95"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden text-[#F8A201] p-2 focus:outline-none focus:ring-2 focus:ring-[#F8A201] rounded-lg transition-transform active:scale-95 z-50"
          aria-label="Toggle navigation menu"
        >
          <svg
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {isOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Drawer (Uses strict z-index stack and locks body viewport) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden touch-none">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Menu (Fixed right positioning with fixed max width) */}
          <div className="fixed top-0 right-0 h-full w-[280px] bg-[#130D08] border-l border-[#F8A201]/20 p-6 z-50 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-gray-800">
                <span className="text-[#F8A201] font-semibold text-lg">Menu</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-[#F8A201] p-1 rounded-md focus:outline-none"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-6 flex flex-col space-y-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.href}
                    onClick={() => setIsOpen(false)}
                    className="text-gray-200 font-medium py-2 px-3 rounded-md transition-colors duration-200 hover:text-[#F8A201] hover:bg-[#F8A201]/10"
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex flex-col space-y-3 pt-6 border-t border-gray-800 mt-auto">
              {!loading && user ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="w-full text-center py-2.5 text-sm font-semibold rounded-lg border border-[#F8A201] text-[#F8A201] transition-colors hover:bg-[#F8A201] hover:text-[#130D08]"
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-center py-2.5 text-sm font-semibold rounded-lg bg-[#F8A201] text-[#130D08] transition-colors hover:bg-[#e09200]"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsOpen(false)}
                    className="w-full text-center py-2.5 text-sm font-semibold rounded-lg bg-[#F8A201] text-[#130D08] transition-colors hover:bg-[#e09200]"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setIsOpen(false)}
                    className="w-full text-center py-2.5 text-sm font-semibold rounded-lg border border-[#F8A201] text-[#F8A201] transition-colors hover:bg-[#F8A201] hover:text-[#130D08]"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}