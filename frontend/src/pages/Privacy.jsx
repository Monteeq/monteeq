import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import './Legal.css';

const Privacy = () => {
    return (
        <div className="legal-container">
            <Link to="/signup" className="legal-back">
                <ArrowLeft size={18} />
                Back to Sign Up
            </Link>
            
            <div className="legal-card">
                <div className="legal-header">
                    <Shield size={48} className="mb-4" style={{ color: 'var(--accent-primary)', margin: '0 auto 20px' }} />
                    <h1>Privacy Policy</h1>
                    <p>Last updated: April 25, 2026</p>
                </div>
                
                <div className="legal-content">
                    <p>At Monteeq, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information when you use our platform.</p>
                    
                    <h2>1. Information We Collect</h2>
                    <p>We collect information that you provide directly to us, including:</p>
                    <ul>
                        <li>Account information (username, email, password)</li>
                        <li>Profile information (full name, bio, profile picture)</li>
                        <li>Content you upload (videos, comments, posts)</li>
                        <li>Payment information (processed securely through third-party providers like Stripe and Paystack)</li>
                    </ul>
                    
                    <h2>2. How We Use Your Information</h2>
                    <p>We use the information we collect to:</p>
                    <ul>
                        <li>Provide, maintain, and improve our services</li>
                        <li>Process transactions and send related information</li>
                        <li>Send you technical notices, updates, and security alerts</li>
                        <li>Personalize your experience and provide relevant content</li>
                        <li>Monitor and analyze trends, usage, and activities</li>
                    </ul>
                    
                    <h2>3. Data Security</h2>
                    <p>We implement a variety of security measures to maintain the safety of your personal information. Your videos are stored securely using Google Cloud Storage, and all sensitive data is encrypted using industry-standard protocols.</p>
                    
                    <h2>4. Cookies</h2>
                    <p>Monteeq uses cookies to enhance your experience, remember your preferences, and provide personalized content. You can disable cookies in your browser settings, but some features of the platform may not function properly.</p>
                    
                    <h2>5. Third-Party Services</h2>
                    <p>We may use third-party services (such as Google OAuth for login or Stripe/Paystack for payments) that collect information according to their own privacy policies.</p>
                    
                    <h2>6. Your Rights</h2>
                    <p>You have the right to access, update, or delete your personal information at any time through your account settings. For any further requests, please contact our support team.</p>
                    
                    <h2>7. Changes to This Policy</h2>
                    <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.</p>
                </div>
            </div>
        </div>
    );
};

export default Privacy;
