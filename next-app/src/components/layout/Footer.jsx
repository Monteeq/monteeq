"use client";

import React from 'react';
import Link from 'next/link';
import '@/styles/components/Footer.css';

const Footer = ({ className = '', style = {} }) => {
    return (
        <footer className={`global-footer ${className}`} style={style}>
            <div className="footer-content">
                <div className="footer-brand">
                    <img src="/images/logo.png" alt="Monteeq" className="footer-logo-img" />
                    <span className="footer-name">Monteeq</span>
                </div>
                <div className="footer-links">
                    <Link href="/about">About</Link>
                    <Link href="/partner">Partner</Link>
                    <Link href="/pro">Join Pro</Link>
                    <Link href="/privacy">Privacy Policy</Link>
                    <Link href="/terms">Terms of Service</Link>
                </div>
                <div className="footer-copy">
                    © 2026 Monteeq Creative Group. All rights reserved.
                </div>
            </div>
        </footer>
    );
};

export default Footer;
