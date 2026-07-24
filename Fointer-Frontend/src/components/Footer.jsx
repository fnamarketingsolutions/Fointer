import React from 'react';
import { FiGlobe, FiShare2, FiYoutube } from 'react-icons/fi';
import logo from '../assets/fointer-logo.png';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-[#130D08] text-white pt-16 pb-8 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-5 gap-10 pb-12">
        
        {/* Brand Column */}
        <div className="md:col-span-2 space-y-2">
          <img src={logo} alt="Fointer" className="h-20 w-18 object-contain rounded pt-2" />
          <p className="text-xs text-gray-400 max-w-sm leading-relaxed font-light">
            Defining the next era of digital sovereignty and elite collaboration for the focused professional.
          </p>
          <div className="flex space-x-3 pt-2">
            <a href="#" className="p-2.5 rounded-full border border-white/10 text-gray-400 hover:text-[#F8A201] hover:border-[#F8A201] transition-colors">
              <FiGlobe size={16} />
            </a>
            <a href="#" className="p-2.5 rounded-full border border-white/10 text-gray-400 hover:text-[#F8A201] hover:border-[#F8A201] transition-colors">
              <FiShare2 size={16} />
            </a>
            <a href="#" className="p-2.5 rounded-full border border-white/10 text-gray-400 hover:text-[#F8A201] hover:border-[#F8A201] transition-colors">
              <FiYoutube size={16} />
            </a>
          </div>
        </div>

        {/* Platform Links */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-[#F8A201] mb-4">Platform</h4>
          <ul className="space-y-2.5 text-xs text-gray-400">
            <li><a href="/about" className="hover:text-amber-50 transition-colors">About Us</a></li>
            <li><a href="/contact-us" className="hover:text-amber-50 transition-colors">Contact Us</a></li>
            <li><a href="/how-to-use" className="hover:text-amber-50 transition-colors">How TO Use</a></li>
            <li><a href="/code-of-conduct" className="hover:text-amber-50 transition-colors">Code Of Conduct</a></li>
            <li><a href="/network-use-cases" className="hover:text-amber-50 transition-colors">Network Use Cases</a></li>
          </ul>
        </div>

        {/* Company Links */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-[#F8A201] mb-4">LEGAL</h4>
          <ul className="space-y-2.5 text-xs text-gray-400">
            <li><Link to="/privacy-policy" className="hover:text-amber-50 transition-colors">Privacy Policy</Link></li>
            <li><Link to="/terms-and-conditions" className="hover:text-amber-50 transition-colors">Terms and Conditions</Link></li>
            <li><Link to="/user-agreement" className="hover:text-amber-50 transition-colors">User Agreement</Link></li>
            <li><Link to="/content-policy" className="hover:text-amber-50 transition-colors">Content Policy</Link></li>
            <li><Link to="/cookie-policy" className="hover:text-amber-50 transition-colors">Cookie Notice</Link></li>
          </ul>
        </div>

        {/* Legal Links */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-[#F8A201] mb-4">HeadQuarters</h4>
          <ul className="space-y-2.5 text-xs text-gray-400">

  {/* Physical Address */}
  <li className="pt-2 text-gray-400 leading-relaxed">
    123 Tech Avenue, Suite 400<br />
    San Francisco, CA 94107
  </li>

  {/* Contact Info */}
  <li className="pt-1">
    <a href="mailto:support@yourdomain.com" className="hover:text-amber-50 transition-colors">
      support@yourdomain.com
    </a>
  </li>
  <li>
    <a href="tel:+18005550199" className="hover:text-amber-50 transition-colors">
      +1 (800) 555-0199
    </a>
  </li>
</ul>
        </div>

      </div>

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-center text-[11px] text-gray-500 gap-4">
      <p>© {new Date().getFullYear()} FOINTER Networks. All rights reserved.</p>
      
      </div>
    </footer>
  );
}