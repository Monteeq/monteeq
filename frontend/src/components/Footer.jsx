import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/images/logo.png';
import './Footer.css';

const Footer = ({ className = '', style = {} }) => {
    return (
        <footer className={`global-footer ${className}`} style={style}>
            <div className="footer-content">
                <div className="footer-brand">
                    <img src={logo} alt="Monteeq" className="footer-logo-img" />
                    <span className="footer-name">Monteeq</span>
                </div>
                <div className="footer-links">
                    <Link to="/about">About</Link>
                    <Link to="/partner">Partner</Link>
                    <Link to="/pro">Join Pro</Link>
                    <Link to="/privacy">Privacy Policy</Link>
                    <Link to="/terms">Terms of Service</Link>
                </div>
                <div className="footer-copy">
                    © 2026 Monteeq Creative Group. All rights reserved.
                </div>
            </div>
        </footer>
    );
};

export default Footer;
