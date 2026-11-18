import React from 'react';

export const Footer = () => {
  return (
    <footer className="footer-container">
      <div className="footer-inner">
        <div className="footer-brand-col">
          <div className="footer-brand">
            <div className="brand-icon-wrapper small">
              <svg
                className="brand-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="footer-title">CivicFix AI</span>
          </div>
          <p className="footer-desc">
            AI-Powered Smart Public Issue Reporting &amp; Management System. Empowering citizens and local municipal authorities with modern, transparent infrastructure resolution.
          </p>
          <div className="footer-copyright">
            &copy; {new Date().getFullYear()} CivicFix AI. All rights reserved. Phase 1 Architecture.
          </div>
        </div>

        <div className="footer-links-grid">
          <div className="footer-col">
            <h4 className="footer-col-title">Platform</h4>
            <ul className="footer-list">
              <li><a href="#overview">Public Reporting</a></li>
              <li><a href="#how-it-works">Issue Tracking</a></li>
              <li><a href="#architecture">Municipal Dashboard</a></li>
              <li><a href="#system-health">System Health</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Technology</h4>
            <ul className="footer-list">
              <li><span>React.js + Vite</span></li>
              <li><span>Node.js + Express</span></li>
              <li><span>MongoDB (Phase 2)</span></li>
              <li><span>Gemini AI (Phase 3)</span></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Civic Governance</h4>
            <ul className="footer-list">
              <li><a href="#privacy">Privacy &amp; Data Ethics</a></li>
              <li><a href="#transparency">Public Transparency</a></li>
              <li><a href="#compliance">Municipal Standards</a></li>
              <li><a href="#security">Security Safeguards</a></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
