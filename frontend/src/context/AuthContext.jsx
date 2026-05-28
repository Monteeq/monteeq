import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

import { API_BASE_URL } from '../api';
import { registerPushSubscription } from '../utils/pushSubscription';


export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    const fetchUser = async (authToken) => {
        const currentToken = authToken || token;
        if (currentToken) {
            try {
                const response = await axios.get(`${API_BASE_URL}/users/me`, {
                    headers: { Authorization: `Bearer ${currentToken}` }
                });
                setUser(response.data);
                return response.data;
            } catch (error) {
                console.error("Failed to fetch user:", error);
                if (!authToken && error.response?.status === 401) {
                    logout();
                }
            }
        }
    };

    useEffect(() => {
        fetchUser().finally(() => setLoading(false));
    }, [token]);

    const login = async (credentials) => {
        const params = new URLSearchParams();
        params.append('username', credentials.username);
        params.append('password', credentials.password);

        const response = await axios.post(`${API_BASE_URL}/auth/token`, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        if (response.data.two_factor_required) {
            return response.data; // Return { two_factor_required: true, username: '...' }
        }

        const { access_token } = response.data;
        localStorage.setItem('token', access_token);
        setToken(access_token);
        const loggedInUser = await fetchUser(access_token);
        // Fire-and-forget — silently ask for push permission after login
        registerPushSubscription(access_token);
        return loggedInUser;
    };

    const signup = async (userData) => {
        const response = await axios.post(`${API_BASE_URL}/auth/register`, userData);
        return response.data;
    };

    const googleLogin = async (credential) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/google`, { credential });
            
        if (response.data.two_factor_required) {
            console.log("2FA Required for user:", response.data.username);
            return response.data;
        }

        const { access_token } = response.data;
        if (access_token) {
            localStorage.setItem('token', access_token);
            setToken(access_token);
            const loggedInUser = await fetchUser(access_token);
            // Fire-and-forget push subscription
            registerPushSubscription(access_token);
            return loggedInUser;
        }
        return response.data;
        } catch (error) {
            console.error("Google Login Error:", error.response?.data || error.message);
            throw error;
        }
    };

    const verifyLogin2FA = async (username, code) => {
        const response = await axios.post(`${API_BASE_URL}/auth/verify-2fa`, { username, code });
        const { access_token } = response.data;
        localStorage.setItem('token', access_token);
        setToken(access_token);
        const loggedInUser = await fetchUser(access_token);
        // Fire-and-forget push subscription
        registerPushSubscription(access_token);
        return loggedInUser;
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
    };

    const updateAuthToken = (newToken) => {
        setToken(newToken);
        localStorage.setItem('token', newToken);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, signup, googleLogin, logout, updateAuthToken, setUser, refreshUser: fetchUser, verifyLogin2FA }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
